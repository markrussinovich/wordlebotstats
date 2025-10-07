"use strict";
var WordleBotContent = (() => {
  // src/extension/content/wordleBotContent.ts
  var WordleBotScraper = class {
    constructor() {
      this.isRunning = false;
      this.shouldStop = false;
      this.gamesProcessed = 0;
      this.duplicatesSkipped = 0;
      // Confirmed selectors from v5
      this.GAME_CARD_SELECTOR = ".rating-container:not(.label-container)";
      this.SHOW_MORE_BUTTON_SELECTOR = '[class*="show-more-button"]';
      this.loadMoreNoGrowthAttempts = 0;
      console.log("[WordleBotScraper] Initialized");
      this.setupMessageListener();
      this.checkAutoStart();
    }
    async checkAutoStart() {
      try {
        const params = await chrome.storage.local.get(["wordleBotScrapeParams"]);
        if (params.wordleBotScrapeParams && params.wordleBotScrapeParams.timestamp) {
          const now = Date.now();
          const paramTime = params.wordleBotScrapeParams.timestamp;
          const age = now - paramTime;
          if (age < 3e4) {
            console.log("[WordleBotScraper] Auto-starting scraper...");
            const { mode, stopAtDate, maxIterations } = params.wordleBotScrapeParams;
            setTimeout(() => {
              this.startScraping(mode, stopAtDate, maxIterations);
            }, 2e3);
          }
        }
      } catch (error) {
        console.error("[WordleBotScraper] Error checking auto-start:", error);
      }
    }
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === "START_WORDLE_BOT_SCRAPE" /* START_WORDLE_BOT_SCRAPE */) {
          this.startScraping(message.mode, message.stopAtDate, message.maxIterations).then(() => sendResponse({ success: true })).catch((error) => sendResponse({ success: false, error: error.message }));
          return true;
        } else if (message.type === "GET_NEWEST_PAGE_GAME") {
          this.getNewestPageGame().then((game) => sendResponse({ success: true, game })).catch((error) => sendResponse({ success: false, error: error.message }));
          return true;
        }
        return false;
      });
    }
    async getNewestPageGame() {
      try {
        const games = this.extractVisibleGames();
        if (games.length === 0) {
          return null;
        }
        const sortedGames = games.sort((a, b) => {
          if (a.gameNumber && b.gameNumber) {
            return b.gameNumber - a.gameNumber;
          }
          if (a.date && b.date) {
            return b.date.localeCompare(a.date);
          }
          return 0;
        });
        return sortedGames[0] || null;
      } catch (error) {
        console.error("[WordleBotScraper] Error getting newest page game:", error);
        return null;
      }
    }
    async startScraping(mode, stopAtDate, maxIterations = 50) {
      if (this.isRunning) {
        console.log("[WordleBotScraper] Already running");
        return;
      }
      this.isRunning = true;
      this.shouldStop = false;
      this.gamesProcessed = 0;
      this.duplicatesSkipped = 0;
      this.loadMoreNoGrowthAttempts = 0;
      console.log(`[WordleBotScraper] Starting ${mode} scrape`);
      this.sendProgress(0, 0, "Opening WordleBot page...");
      try {
        await this.scrapeWithRetry(stopAtDate, maxIterations, 0, /* @__PURE__ */ new Map());
      } catch (error) {
        console.error("[WordleBotScraper] Error during scraping:", error);
        this.sendError(
          error instanceof Error ? error.message : "Unknown error",
          "UNKNOWN",
          false
        );
      } finally {
        this.isRunning = false;
      }
    }
    async scrapeWithRetry(stopAtDate, maxIterations, iteration, allGames) {
      if (this.shouldStop || iteration >= maxIterations) {
        console.log("[WordleBotScraper] Stopping: shouldStop=" + this.shouldStop + ", iteration=" + iteration);
        await this.processAndSendGames(Array.from(allGames.values()));
        return;
      }
      if (iteration === 0) {
        console.log("[WordleBotScraper] First iteration - navigating to game history...");
        this.sendProgress(0, 0, "Navigating to game history...");
        const navigated = await this.navigateToGameHistory();
        if (!navigated) {
          console.error("[WordleBotScraper] Failed to navigate to game history");
          this.sendError("Could not navigate to game history. Please ensure you are logged in.", "PARSE_ERROR", true);
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (iteration === 0) {
        this.sendProgress(0, 0, "Scanning for games...");
      }
      const games = this.extractVisibleGames();
      console.log(`[WordleBotScraper] Iteration ${iteration + 1}: Found ${games.length} games`);
      if (games.length === 0 && iteration === 0) {
        console.log("[WordleBotScraper] No games found on first attempt, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        return this.scrapeWithRetry(stopAtDate, maxIterations, iteration, allGames);
      }
      let newGamesThisIteration = 0;
      let reachedStopDate = false;
      for (const game of games) {
        const key = game.gameNumber?.toString() || game.date || game.solution || "";
        if (key && !allGames.has(key)) {
          allGames.set(key, game);
          newGamesThisIteration++;
        } else if (key && stopAtDate) {
          console.log(`[WordleBotScraper] Found duplicate game (${game.date || game.gameNumber}), stopping incremental scrape`);
          reachedStopDate = true;
          break;
        }
        if (stopAtDate && game.date && game.date < stopAtDate) {
          console.log(`[WordleBotScraper] Reached date before stop date: ${game.date} < ${stopAtDate}`);
          reachedStopDate = true;
          break;
        }
      }
      console.log(`[WordleBotScraper] Added ${newGamesThisIteration} new games (total: ${allGames.size})`);
      this.sendProgress(allGames.size, this.gamesProcessed, "loading");
      if (reachedStopDate) {
        console.log("[WordleBotScraper] Reached stop date, completing scrape");
        await this.processAndSendGames(Array.from(allGames.values()));
        return;
      }
      const loadedMore = await this.loadMoreGames();
      if (loadedMore) {
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        return this.scrapeWithRetry(stopAtDate, maxIterations, iteration + 1, allGames);
      } else {
        console.log("[WordleBotScraper] No more games to load");
        await this.processAndSendGames(Array.from(allGames.values()));
      }
    }
    async navigateToGameHistory() {
      try {
        console.log('[WordleBotScraper] Looking for "Compare and view your recent scores" button...');
        let compareButton = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          const allButtons = document.querySelectorAll('button, a, div[role="button"], [class*="button"], div.action-item, .action-item');
          for (const btn of Array.from(allButtons)) {
            const text = (btn.textContent || "").trim();
            const lowerText = text.toLowerCase();
            if (lowerText.includes("compare") && (lowerText.includes("recent") || lowerText.includes("score")) || lowerText.includes("view") && lowerText.includes("recent")) {
              compareButton = btn;
              console.log("[WordleBotScraper] Found navigation button");
              break;
            }
          }
          if (compareButton) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
        if (compareButton) {
          console.log('[WordleBotScraper] Clicking "Compare and view your recent scores"...');
          compareButton.click();
          await new Promise((resolve) => setTimeout(resolve, 2e3));
          console.log("[WordleBotScraper] Navigating to game history section...");
          const slideDots = document.querySelectorAll(".slide-dot");
          if (slideDots.length >= 3) {
            console.log("[WordleBotScraper] Found slide dots, clicking third dot...");
            slideDots[2].click();
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const cards2 = document.querySelectorAll(this.GAME_CARD_SELECTOR);
            if (cards2.length > 0) {
              console.log("[WordleBotScraper] \u2713 Successfully navigated to game history via slide dot!");
              return true;
            }
          }
          console.log("[WordleBotScraper] Trying keyboard navigation (right arrow x2)...");
          for (let i = 0; i < 2; i++) {
            const rightArrowEvent = new KeyboardEvent("keydown", {
              key: "ArrowRight",
              code: "ArrowRight",
              keyCode: 39,
              which: 39,
              bubbles: true
            });
            document.dispatchEvent(rightArrowEvent);
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
          if (cards.length > 0) {
            console.log("[WordleBotScraper] \u2713 Successfully navigated to game history via keyboard!");
            return true;
          }
          console.log("[WordleBotScraper] Trying arrow buttons...");
          const arrowButtons = document.querySelectorAll('button[aria-label*="next"], button[aria-label*="right"], .next-button, [class*="arrow"]');
          if (arrowButtons.length > 0) {
            for (let i = 0; i < 2; i++) {
              arrowButtons[0].click();
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
            await new Promise((resolve) => setTimeout(resolve, 1e3));
            const cardsAfterArrow = document.querySelectorAll(this.GAME_CARD_SELECTOR);
            if (cardsAfterArrow.length > 0) {
              console.log("[WordleBotScraper] \u2713 Successfully navigated to game history via arrow button!");
              return true;
            }
          }
          console.log("[WordleBotScraper] \u2717 Could not navigate to game history section");
          return false;
        } else {
          console.log("[WordleBotScraper] Compare button not found, checking if already on history page...");
          const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
          if (cards.length > 0) {
            console.log("[WordleBotScraper] Already on game history page!");
            return true;
          }
          return false;
        }
      } catch (error) {
        console.error("[WordleBotScraper] Error navigating to game history:", error);
        return false;
      }
    }
    extractVisibleGames() {
      const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
      const games = [];
      cards.forEach((card) => {
        try {
          const game = this.extractGameFromCard(card);
          if (game.solution || game.gameNumber) {
            games.push(game);
          }
        } catch (error) {
          console.error("[WordleBotScraper] Error extracting game:", error);
        }
      });
      return games;
    }
    extractGameFromCard(card) {
      const game = {};
      const solutionEl = card.querySelector("strong.solution");
      if (solutionEl) {
        game.solution = solutionEl.textContent?.trim().toUpperCase();
        console.log("[WordleBotScraper] Found solution:", game.solution);
      }
      const dateEl = card.querySelector("span.date-label");
      if (dateEl) {
        const dateText = dateEl.textContent?.trim() || "";
        game.dateString = dateText;
        const dateMatch = dateText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
        if (dateMatch && dateMatch[1] && dateMatch[2]) {
          const monthName = dateMatch[1];
          const day = parseInt(dateMatch[2], 10);
          const currentDate = /* @__PURE__ */ new Date();
          const currentYear = currentDate.getFullYear();
          const monthIndex = (/* @__PURE__ */ new Date(`${monthName} 1, ${currentYear}`)).getMonth();
          const currentDateUtc = Date.UTC(currentYear, currentDate.getMonth(), currentDate.getDate());
          let candidateUtc = Date.UTC(currentYear, monthIndex, day);
          if (candidateUtc > currentDateUtc) {
            candidateUtc = Date.UTC(currentYear - 1, monthIndex, day);
          }
          const isoDate = new Date(candidateUtc).toISOString().split("T")[0];
          if (isoDate) {
            game.date = isoDate;
            console.log("[WordleBotScraper] Found date:", game.date, "from", game.dateString);
          }
        }
      }
      const ratingRight = card.querySelector(".rating-right");
      if (ratingRight) {
        const numValues = ratingRight.querySelectorAll(".rating-value.num span.num");
        if (numValues.length >= 2 && numValues[0] && numValues[1]) {
          game.skillScore = parseInt(numValues[0].textContent?.trim() || "0", 10);
          console.log("[WordleBotScraper] Found skill:", game.skillScore);
          game.luckScore = parseInt(numValues[1].textContent?.trim() || "0", 10);
          console.log("[WordleBotScraper] Found luck:", game.luckScore);
          if (numValues.length >= 3 && numValues[2]) {
            const stepsText = numValues[2].textContent?.trim() || "";
            if (stepsText === "-" || stepsText === "\u2014" || stepsText === "\u2013" || stepsText === "") {
              game.won = false;
              game.steps = 7;
              console.log("[WordleBotScraper] Lost game (dash or empty detected)");
            } else {
              const parsedSteps = parseInt(stepsText, 10);
              if (isNaN(parsedSteps) || parsedSteps === 0) {
                game.won = false;
                game.steps = 7;
                console.log("[WordleBotScraper] Lost game (invalid steps)");
              } else {
                game.steps = parsedSteps;
                game.won = true;
                console.log("[WordleBotScraper] Found steps:", game.steps);
              }
            }
          } else {
            if (game.skillScore !== void 0 && game.luckScore !== void 0) {
              game.won = false;
              game.steps = 7;
              console.log("[WordleBotScraper] Lost game (no steps data)");
            }
          }
        }
      }
      const boardEl = card.querySelector(".wordle-board, .micro");
      if (boardEl) {
        console.log("[WordleBotScraper] Found board element");
      }
      const boardImage = card.querySelector("img[src]");
      if (boardImage) {
        game.boardImageUrl = boardImage.src;
        console.log("[WordleBotScraper] Found board image:", game.boardImageUrl);
      }
      const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
      if (link && !link.getAttribute("href")?.includes("index.html")) {
        game.analysisUrl = link.href;
      }
      return game;
    }
    async loadMoreGames() {
      const button = this.findShowMoreButton();
      if (!button) {
        console.log("[WordleBotScraper] Load more button not found");
        return false;
      }
      const style = window.getComputedStyle(button);
      const isHidden = style.display === "none" || style.visibility === "hidden";
      const isDisabled = button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true";
      if (isHidden || isDisabled) {
        console.log("[WordleBotScraper] Load more button unavailable (hidden or disabled)");
        return false;
      }
      const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      console.log(`[WordleBotScraper] Clicking load more button. Current cards: ${beforeCount}`);
      try {
        button.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (error) {
        console.warn("[WordleBotScraper] Failed to scroll load more button into view:", error);
      }
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const afterCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      const newCards = afterCount - beforeCount;
      console.log(`[WordleBotScraper] After load more: ${afterCount} cards (${newCards} new)`);
      if (newCards > 0) {
        this.loadMoreNoGrowthAttempts = 0;
        return true;
      }
      this.loadMoreNoGrowthAttempts += 1;
      const stillHasButton = !!this.findShowMoreButton();
      if (stillHasButton && this.loadMoreNoGrowthAttempts < 3) {
        console.log("[WordleBotScraper] No new cards detected yet; retrying while button remains visible.");
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        return true;
      }
      console.log("[WordleBotScraper] No additional cards after multiple attempts, stopping pagination.");
      return false;
    }
    findShowMoreButton() {
      const selectors = [
        this.SHOW_MORE_BUTTON_SELECTOR,
        ".show-more-button",
        ".show-more-container button",
        'button[class*="show-more"]'
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      }
      const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]'));
      for (const candidate of candidates) {
        const text = candidate.textContent?.toLowerCase().trim();
        if (!text) continue;
        if (text.includes("show more") && text.includes("wordle")) {
          return candidate;
        }
      }
      return null;
    }
    async processAndSendGames(rawGames) {
      console.log(`[WordleBotScraper] Processing ${rawGames.length} games`);
      this.sendProgress(rawGames.length, 0, "Processing games...");
      const sortedGames = rawGames.sort((a, b) => {
        const aNum = a.gameNumber || 0;
        const bNum = b.gameNumber || 0;
        return bNum - aNum;
      });
      const gameResults = sortedGames.map((raw) => this.convertToGameResult(raw));
      const batchSize = 10;
      let imported = 0;
      let duplicates = 0;
      let errors = 0;
      for (let i = 0; i < gameResults.length; i += batchSize) {
        const batch = gameResults.slice(i, i + batchSize);
        this.sendProgress(
          gameResults.length,
          i,
          "processing"
        );
        try {
          const response = await chrome.runtime.sendMessage({
            type: "BULK_IMPORT_GAMES",
            games: batch
          });
          if (response.success) {
            imported += response.imported || 0;
            duplicates += response.duplicates || 0;
            errors += response.errors || 0;
          }
        } catch (error) {
          console.error("[WordleBotScraper] Error sending batch:", error);
          errors += batch.length;
        }
      }
      this.sendComplete(imported, duplicates, errors, sortedGames);
    }
    convertToGameResult(raw) {
      const now = /* @__PURE__ */ new Date();
      const dateString = raw.date ?? now.toISOString().split("T")[0];
      const date = dateString;
      const attempts = raw.steps ?? 0;
      const won = raw.won !== void 0 ? raw.won : attempts > 0 && attempts <= 6;
      return {
        date,
        ...raw.gameNumber && { gameNumber: raw.gameNumber },
        won,
        attempts: attempts > 0 ? attempts : null,
        hardMode: false,
        // WordleBot doesn't track this
        ...raw.solution && { solution: raw.solution },
        ...raw.skillScore !== void 0 && { skillScore: raw.skillScore },
        ...raw.luckScore !== void 0 && { luckScore: raw.luckScore },
        ...raw.boardImageUrl && { boardImageUrl: raw.boardImageUrl },
        ...raw.analysisUrl && { analysisUrl: raw.analysisUrl },
        scrapedFrom: "wordle-bot",
        source: "wordle-page",
        importedAt: now.toISOString(),
        wordLength: 5,
        maxGuesses: 6
      };
    }
    sendProgress(gamesFound, gamesProcessed, status) {
      const message = {
        type: "WORDLE_BOT_SCRAPE_PROGRESS" /* WORDLE_BOT_SCRAPE_PROGRESS */,
        gamesFound,
        gamesProcessed,
        duplicatesSkipped: this.duplicatesSkipped,
        status
      };
      chrome.runtime.sendMessage(message).catch((error) => {
        console.error("[WordleBotScraper] Error sending progress:", error);
      });
    }
    sendComplete(imported, duplicates, errors, games) {
      const message = {
        type: "WORDLE_BOT_SCRAPE_COMPLETE" /* WORDLE_BOT_SCRAPE_COMPLETE */,
        totalGames: games.length,
        newGames: imported,
        duplicates,
        errors
      };
      if (games.length > 0) {
        const oldestGame = games[games.length - 1];
        const newestGame = games[0];
        if (oldestGame?.date && newestGame?.date) {
          message.dateRange = {
            oldest: oldestGame.date,
            newest: newestGame.date
          };
        }
      }
      chrome.runtime.sendMessage(message).catch((error) => {
        console.error("[WordleBotScraper] Error sending completion:", error);
      });
    }
    sendError(error, code, recoverable) {
      const message = {
        type: "WORDLE_BOT_SCRAPE_ERROR" /* WORDLE_BOT_SCRAPE_ERROR */,
        error,
        code,
        recoverable
      };
      chrome.runtime.sendMessage(message).catch((err) => {
        console.error("[WordleBotScraper] Error sending error message:", err);
      });
    }
  };
  var scraper = new WordleBotScraper();
  if (!document.hasFocus()) {
    console.log("[WordleBotScraper] Background mode detected, auto-starting");
  }
  if (typeof window !== "undefined") {
    window.__wordleBotScraper = scraper;
  }
})();
