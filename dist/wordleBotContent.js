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
      this.GAME_CARD_SELECTOR = ".rating-container.svelte-pnoxcy";
      this.SHOW_MORE_BUTTON_SELECTOR = ".show-more-button.svelte-151vgtd";
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
          if (now - paramTime < 3e4) {
            console.log("[WordleBotScraper] Auto-starting scraper with params:", params.wordleBotScrapeParams);
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
    async startScraping(mode, stopAtDate, maxIterations = 20) {
      if (this.isRunning) {
        console.log("[WordleBotScraper] Already running");
        return;
      }
      this.isRunning = true;
      this.shouldStop = false;
      this.gamesProcessed = 0;
      this.duplicatesSkipped = 0;
      console.log(`[WordleBotScraper] Starting ${mode} scrape`);
      try {
        await this.scrapeAllGames(stopAtDate, maxIterations);
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
    async scrapeAllGames(stopAtDate, maxIterations = 20) {
      const allGames = /* @__PURE__ */ new Map();
      let iteration = 0;
      while (iteration < maxIterations && !this.shouldStop) {
        iteration++;
        const games = this.extractVisibleGames();
        console.log(`[WordleBotScraper] Iteration ${iteration}: Found ${games.length} games`);
        let newGamesThisIteration = 0;
        for (const game of games) {
          const key = game.gameNumber?.toString() || game.date || game.solution || "";
          if (key && !allGames.has(key)) {
            allGames.set(key, game);
            newGamesThisIteration++;
            if (stopAtDate && game.date && game.date <= stopAtDate) {
              console.log(`[WordleBotScraper] Reached stop date: ${stopAtDate}`);
              this.shouldStop = true;
              break;
            }
          }
        }
        this.sendProgress(allGames.size, this.gamesProcessed, "scanning");
        if (!this.shouldStop) {
          const hasMore = await this.loadMoreGames();
          if (!hasMore) {
            console.log("[WordleBotScraper] No more games to load");
            break;
          }
        }
      }
      if (iteration >= maxIterations) {
        console.warn(`[WordleBotScraper] Stopped at max iterations (${maxIterations})`);
      }
      await this.processAndSendGames(Array.from(allGames.values()));
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
      const fullText = card.textContent || "";
      const solutionMatch = fullText.match(/solution was:\s*([a-z]{5})/i);
      if (solutionMatch && solutionMatch[1]) {
        game.solution = solutionMatch[1].toUpperCase();
      }
      const dateMatch = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
      if (dateMatch && dateMatch[1] && dateMatch[2]) {
        game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
        const month = dateMatch[1];
        const day = parseInt(dateMatch[2], 10);
        const currentDate = /* @__PURE__ */ new Date();
        const currentYear = currentDate.getFullYear();
        let testDate = /* @__PURE__ */ new Date(`${month} ${day}, ${currentYear}`);
        if (testDate > currentDate) {
          testDate = /* @__PURE__ */ new Date(`${month} ${day}, ${currentYear - 1}`);
        }
        const isoDate = testDate.toISOString().split("T")[0];
        if (isoDate) {
          game.date = isoDate;
        }
      }
      const gameNumMatch = fullText.match(/Game Number[^:]*:\s*(\d{3,4})|#(\d{3,4})|Wordle\s+(\d{3,4})/i);
      if (gameNumMatch) {
        const numStr = gameNumMatch[1] || gameNumMatch[2] || gameNumMatch[3];
        if (numStr) {
          game.gameNumber = parseInt(numStr, 10);
        }
      }
      const skillMatch = fullText.match(/Your score was:\s*(\d{1,3})/i);
      if (skillMatch && skillMatch[1]) {
        game.skillScore = parseInt(skillMatch[1], 10);
      }
      const luckMatch = fullText.match(/Your luck was:\s*(\d{1,3})/i);
      if (luckMatch && luckMatch[1]) {
        game.luckScore = parseInt(luckMatch[1], 10);
      }
      const stepsMatch = fullText.match(/It took you:\s*(\d+)/i);
      if (stepsMatch && stepsMatch[1]) {
        game.steps = parseInt(stepsMatch[1], 10);
        game.won = true;
      }
      const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
      if (link && !link.getAttribute("href")?.includes("index.html")) {
        game.analysisUrl = link.href;
      }
      return game;
    }
    async loadMoreGames() {
      const btn = document.querySelector(this.SHOW_MORE_BUTTON_SELECTOR);
      if (!btn || btn.offsetParent === null) {
        return false;
      }
      const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const afterCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      const newCards = afterCount - beforeCount;
      return newCards > 0;
    }
    async processAndSendGames(rawGames) {
      console.log(`[WordleBotScraper] Processing ${rawGames.length} games`);
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
      return {
        date,
        ...raw.gameNumber && { gameNumber: raw.gameNumber },
        won: raw.won ?? true,
        attempts: raw.steps ?? null,
        hardMode: false,
        // WordleBot doesn't track this
        ...raw.solution && { solution: raw.solution },
        ...raw.skillScore !== void 0 && { skillScore: raw.skillScore },
        ...raw.luckScore !== void 0 && { luckScore: raw.luckScore },
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
