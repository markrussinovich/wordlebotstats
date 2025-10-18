var WordleBotContent = (() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => {
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    return value;
  };

  // src/extension/utils/logger.ts
  var import_meta = {};
  var g = globalThis;
  function resolveEnvFlag() {
    try {
      if (typeof import_meta !== "undefined" && import_meta?.env) {
        const val = import_meta.env.VITE_DEBUG_LOGS;
        if (val != null)
          return val === "true" || val === true;
      }
    } catch {
    }
    try {
      if (typeof process !== "undefined" && process?.env) {
        const v = process.env.VITE_DEBUG_LOGS;
        if (v != null)
          return v === "true";
      }
    } catch {
    }
    return false;
  }
  function resolveStorageFlag() {
    try {
      return localStorage.getItem("WORDLE_DEBUG_LOGS") === "true";
    } catch {
      return false;
    }
  }
  var enabled = resolveEnvFlag() || resolveStorageFlag();
  function setDebugLogging(on) {
    enabled = on;
    try {
      localStorage.setItem("WORDLE_DEBUG_LOGS", on ? "true" : "false");
    } catch {
    }
  }
  g.WORDLE_ENABLE_DEBUG_LOGS = () => setDebugLogging(true);
  g.WORDLE_DISABLE_DEBUG_LOGS = () => setDebugLogging(false);
  function prefix() {
    return `[${(/* @__PURE__ */ new Date()).toISOString()}]`;
  }
  function build(method) {
    return (...args) => {
      if (enabled)
        console[method](prefix(), ...args);
    };
  }
  var logger = {
    enabled: () => enabled,
    log: build("log"),
    warn: build("warn"),
    error: build("error")
  };
  var logger_default = logger;

  // src/extension/content/wordleBotContent.ts
  var log = logger_default.log;
  var errorLog = logger_default.error;
  var WordleBotScraper = class {
    constructor() {
      __publicField(this, "isRunning", false);
      __publicField(this, "shouldStop", false);
      __publicField(this, "gamesProcessed", 0);
      __publicField(this, "duplicatesSkipped", 0);
      __publicField(this, "processedCardElements", /* @__PURE__ */ new WeakSet());
      // Track processed cards to avoid re-extraction
      // Confirmed selectors from v5
      __publicField(this, "GAME_CARD_SELECTOR", ".rating-container:not(.label-container)");
      __publicField(this, "SHOW_MORE_BUTTON_SELECTOR", '[class*="show-more-button"]');
      __publicField(this, "loadMoreNoGrowthAttempts", 0);
      log("[WordleBotScraper] Initialized");
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
            log("[WordleBotScraper] Auto-starting scraper...");
            const { mode, stopAtDate, maxIterations } = params.wordleBotScrapeParams;
            setTimeout(() => {
              this.startScraping(mode, stopAtDate, maxIterations);
            }, 2e3);
          }
        }
      } catch (error) {
        errorLog("[WordleBotScraper] Error checking auto-start:", error);
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
          const loginRequired = this.isLoginRequired();
          const errorMessage = loginRequired ? "Please sign in to your NYTimes account to import Wordle Bot history." : "Could not navigate to game history. Please ensure you are logged in and Wordle Bot is available.";
          const errorCode = loginRequired ? "AUTH_REQUIRED" : "PARSE_ERROR";
          this.sendError(errorMessage, errorCode, true);
          return;
        }
      }
      await this.delay(300);
      if (iteration === 0) {
        this.sendProgress(0, 0, "Scanning for games...");
      }
      const games = this.extractVisibleGames();
      console.log(`[WordleBotScraper] Iteration ${iteration + 1}: Found ${games.length} games`);
      if (games.length === 0 && iteration === 0) {
        console.log("[WordleBotScraper] No games found on first attempt, retrying...");
        await this.delay(500);
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
      console.log(`[WordleBotScraper] Iteration ${iteration}: Attempting to load more games...`);
      const loadedMore = await this.loadMoreGames();
      console.log(`[WordleBotScraper] Iteration ${iteration}: loadMoreGames returned ${loadedMore}`);
      if (loadedMore) {
        console.log(`[WordleBotScraper] Iteration ${iteration}: Continuing to next iteration`);
        await this.delay(300);
        return this.scrapeWithRetry(stopAtDate, maxIterations, iteration + 1, allGames);
      } else {
        console.log(`[WordleBotScraper] =====> Iteration ${iteration}: loadMoreGames returned FALSE`);
        console.log(`[WordleBotScraper] =====> No more games to load, completing scrape with ${allGames.size} games`);
        console.log(`[WordleBotScraper] =====> About to call processAndSendGames...`);
        await this.processAndSendGames(Array.from(allGames.values()));
        console.log(`[WordleBotScraper] =====> processAndSendGames completed, scrapeWithRetry ending`);
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
          await this.delay(300);
        }
        if (compareButton) {
          console.log('[WordleBotScraper] Clicking "Compare and view your recent scores"...');
          compareButton.click();
          await this.waitForSelector(".slide-dot", 2500);
          console.log("[WordleBotScraper] Navigating to game history section...");
          const slideDots = document.querySelectorAll(".slide-dot");
          if (slideDots.length >= 3) {
            console.log("[WordleBotScraper] Found slide dots, clicking third dot...");
            slideDots[2].click();
            const cardsReady = await this.waitForSelector(this.GAME_CARD_SELECTOR, 1500);
            if (cardsReady) {
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
            await this.delay(200);
          }
          const cardsViaKeyboard = await this.waitForSelector(this.GAME_CARD_SELECTOR, 1200);
          if (cardsViaKeyboard) {
            console.log("[WordleBotScraper] \u2713 Successfully navigated to game history via keyboard!");
            return true;
          }
          console.log("[WordleBotScraper] Trying arrow buttons...");
          const arrowButtons = document.querySelectorAll('button[aria-label*="next"], button[aria-label*="right"], .next-button, [class*="arrow"]');
          if (arrowButtons.length > 0) {
            for (let i = 0; i < 2; i++) {
              arrowButtons[0].click();
              await this.delay(200);
            }
            const cardsAfterArrow = await this.waitForSelector(this.GAME_CARD_SELECTOR, 1200);
            if (cardsAfterArrow) {
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
    isLoginRequired() {
      try {
        const loginSelectors = [
          'button[data-testid="login-button"]',
          'button[data-testid="sign-in-button"]',
          'a[data-testid="login-button"]',
          'a[href*="login"]',
          '[data-testid="gdpr-consent-banner"] button[data-testid="login-button"]'
        ];
        for (const selector of loginSelectors) {
          if (document.querySelector(selector)) {
            return true;
          }
        }
        const bodyText = document.body?.innerText?.toLowerCase() || "";
        if (bodyText.includes("log in to view") || bodyText.includes("sign in to see your wordle") || bodyText.includes("sign in to continue")) {
          return true;
        }
      } catch (error) {
        console.error("[WordleBotScraper] Error detecting login state:", error);
      }
      return false;
    }
    extractVisibleGames() {
      console.log(`[WordleBotScraper] =====> extractVisibleGames() called, searching for cards...`);
      const extractStart = performance.now();
      const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
      console.log(`[WordleBotScraper] =====> Found ${cards.length} card elements`);
      const games = [];
      let skipped = 0;
      cards.forEach((card, index) => {
        if (this.processedCardElements.has(card)) {
          skipped++;
          return;
        }
        try {
          const cardStart = performance.now();
          const game = this.extractGameFromCard(card);
          const cardDuration = (performance.now() - cardStart).toFixed(0);
          if (game.solution || game.gameNumber) {
            games.push(game);
            this.processedCardElements.add(card);
            if (cardDuration !== "0") {
              console.log(`[WordleBotScraper] =====> Card ${index + 1}: Extracted in ${cardDuration}ms (${game.solution || game.gameNumber})`);
            }
          }
        } catch (error) {
          console.error("[WordleBotScraper] Error extracting game:", error);
        }
      });
      const extractDuration = (performance.now() - extractStart).toFixed(0);
      console.log(`[WordleBotScraper] =====> extractVisibleGames() complete: ${games.length} new games, ${skipped} cached, ${extractDuration}ms total`);
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
      const boardVisual = this.extractBoardVisual(card);
      if (boardVisual) {
        if (boardVisual.pattern && boardVisual.pattern.length > 0) {
          game.guessPattern = boardVisual.pattern;
        }
        if (boardVisual.image) {
          game.boardImageUrl = boardVisual.image;
        }
      }
      const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
      if (link && !link.getAttribute("href")?.includes("index.html")) {
        game.analysisUrl = link.href;
      }
      this.inferGameOutcome(game);
      return game;
    }
    extractBoardVisual(card) {
      const svgBoard = this.findSvgBoard(card);
      if (svgBoard) {
        const pattern2 = this.extractPatternFromSvg(svgBoard);
        const image2 = this.serializeSvgElement(svgBoard);
        if (pattern2 && pattern2.length > 0 || image2) {
          return {
            ...image2 ? { image: image2 } : {},
            ...pattern2.length > 0 ? { pattern: pattern2 } : {}
          };
        }
      }
      const boardElement = this.findBoardElement(card);
      let pattern = [];
      if (boardElement) {
        pattern = this.extractGuessPatternFromBoard(boardElement);
      }
      let image = null;
      if (pattern.length > 0) {
        image = this.renderGuessPatternToImage(pattern);
      }
      if (!image) {
        const fallbackImage = card.querySelector("img[src]");
        if (fallbackImage) {
          image = fallbackImage.src;
        }
      }
      if (pattern && pattern.length > 0 || image) {
        return {
          ...image ? { image } : {},
          ...pattern.length > 0 ? { pattern } : {}
        };
      }
      return null;
    }
    findSvgBoard(card) {
      const svgCandidates = Array.from(card.querySelectorAll("svg"));
      for (const svg of svgCandidates) {
        const rectCount = svg.querySelectorAll("rect").length;
        if (rectCount >= 10) {
          return svg;
        }
      }
      return null;
    }
    serializeSvgElement(svg) {
      try {
        const clone = svg.cloneNode(true);
        if (!clone.getAttribute("xmlns")) {
          clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        }
        if (!clone.getAttribute("viewBox")) {
          try {
            if ("getBBox" in svg) {
              const bbox = svg.getBBox();
              if (bbox) {
                clone.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
                if (!clone.getAttribute("width")) {
                  clone.setAttribute("width", `${bbox.width}`);
                }
                if (!clone.getAttribute("height")) {
                  clone.setAttribute("height", `${bbox.height}`);
                }
              }
            }
          } catch (error) {
            console.warn("[WordleBotScraper] Failed to calculate SVG bbox", error);
          }
        }
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clone);
        const encoded = window.btoa(unescape(encodeURIComponent(svgString)));
        return `data:image/svg+xml;base64,${encoded}`;
      } catch (error) {
        console.warn("[WordleBotScraper] Failed to serialize SVG board", error);
        return null;
      }
    }
    findBoardElement(card) {
      const selectors = [
        ".wordle-board",
        ".micro",
        ".micro-board",
        ".mini-board",
        '.rating-left [class*="board"]',
        '[data-testid*="board"]',
        '[role="grid"]',
        '[class*="grid"]'
      ];
      for (const selector of selectors) {
        const element = card.querySelector(selector);
        if (element && element !== card) {
          return element;
        }
      }
      const fallbackCandidates = Array.from(card.querySelectorAll('[class*="board"], [data-board], [data-testid], [role="grid"]'));
      for (const candidate of fallbackCandidates) {
        if (candidate === card)
          continue;
        const tileCount = candidate.querySelectorAll("[data-state], [data-status], rect, canvas").length;
        if (tileCount >= 10) {
          return candidate;
        }
      }
      return null;
    }
    extractPatternFromSvg(svg) {
      const rects = Array.from(svg.querySelectorAll("rect"));
      if (rects.length === 0) {
        return [];
      }
      const xPositions = this.collectUniquePositions(rects, "x");
      const yPositions = this.collectUniquePositions(rects, "y");
      if (xPositions.length === 0 || yPositions.length === 0) {
        return [];
      }
      const pattern = [];
      yPositions.forEach((y) => {
        const row = [];
        xPositions.forEach((x) => {
          const rect = this.findRectAt(rects, x, y);
          const fill = rect ? this.getSvgFillColor(rect) : null;
          const colorStatus = this.mapColorToStatus(fill);
          const status = colorStatus && colorStatus !== "empty" ? colorStatus : "absent";
          row.push({ letter: "", status });
        });
        if (row.length > 0) {
          pattern.push(row);
        }
      });
      return pattern;
    }
    collectUniquePositions(rects, axis) {
      const values = rects.map((rect) => this.getSvgCoordinate(rect, axis)).filter((value) => value !== null).map((value) => Math.round(value * 10) / 10);
      return Array.from(new Set(values)).sort((a, b) => a - b);
    }
    findRectAt(rects, x, y) {
      for (const rect of rects) {
        const rectX = this.getSvgCoordinate(rect, "x");
        const rectY = this.getSvgCoordinate(rect, "y");
        if (rectX !== null && rectY !== null && this.nearlyEqual(rectX, x) && this.nearlyEqual(rectY, y)) {
          return rect;
        }
      }
      return null;
    }
    getSvgCoordinate(rect, attribute) {
      const animated = rect[attribute];
      if (animated && typeof animated.baseVal?.value === "number") {
        return animated.baseVal.value;
      }
      const attrValue = rect.getAttribute(attribute);
      if (attrValue) {
        const parsed = parseFloat(attrValue);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
      return null;
    }
    nearlyEqual(a, b, tolerance = 0.5) {
      return Math.abs(a - b) <= tolerance;
    }
    getSvgFillColor(rect) {
      const attrFill = rect.getAttribute("fill");
      if (attrFill && attrFill !== "none") {
        return attrFill;
      }
      if (rect.style && rect.style.fill) {
        return rect.style.fill;
      }
      try {
        const computed = window.getComputedStyle(rect);
        if (computed && computed.fill && computed.fill !== "none") {
          return computed.fill;
        }
      } catch (error) {
        console.warn("[WordleBotScraper] Failed to get SVG fill color", error);
      }
      return null;
    }
    extractGuessPatternFromBoard(boardEl) {
      const pattern = [];
      const rows = this.getCandidateBoardRows(boardEl);
      const expectedLength = this.detectBoardWordLength(boardEl);
      if (rows.length > 0) {
        rows.forEach((rowEl) => {
          const tiles = this.collectTileElements(rowEl);
          const rowPattern = this.convertTilesToGuessResults(tiles, expectedLength);
          if (rowPattern) {
            pattern.push(rowPattern);
          }
        });
        if (pattern.length > 0) {
          return pattern;
        }
      }
      const fallbackTiles = this.collectTileElements(boardEl);
      if (fallbackTiles.length === 0) {
        return [];
      }
      const fallbackRowLength = this.detectBoardWordLength(boardEl, fallbackTiles.length);
      for (let i = 0; i < fallbackTiles.length; i += fallbackRowLength) {
        const chunk = fallbackTiles.slice(i, i + fallbackRowLength);
        const rowPattern = this.convertTilesToGuessResults(chunk, fallbackRowLength);
        if (rowPattern) {
          pattern.push(rowPattern);
        }
      }
      return pattern;
    }
    getCandidateBoardRows(boardEl) {
      const asElement = boardEl;
      const directChildren = Array.from(asElement.children);
      const directRows = directChildren.filter((child) => this.looksLikeBoardRow(child));
      if (directRows.length > 0) {
        return directRows;
      }
      const selector = '[class*="row"], [data-row], [data-row-index], [role="row"], .history-row, .guess-row, .wordle-row';
      const candidates = Array.from(asElement.querySelectorAll(selector));
      return candidates.filter((el) => el !== asElement && this.looksLikeBoardRow(el));
    }
    looksLikeBoardRow(element) {
      const className = (element.className || "").toString().toLowerCase();
      if (!className && !element.getAttribute("role")) {
        return false;
      }
      if (className.includes("row") || className.includes("guess") || className.includes("attempt") || className.includes("history")) {
        return true;
      }
      const role = element.getAttribute("role");
      if (role && role.toLowerCase() === "row") {
        return true;
      }
      if (element.getAttribute("data-row") || element.getAttribute("data-row-index")) {
        return true;
      }
      return false;
    }
    collectTileElements(root) {
      const asElement = root;
      const direct = Array.from(asElement.children);
      const directTiles = direct.filter((child) => this.getTileStatus(child) !== null);
      if (directTiles.length > 0) {
        return directTiles;
      }
      const selector = '[data-state], [data-status], [aria-label*="correct"], [aria-label*="present"], [aria-label*="absent"], .tile, .Tile, .board-tile, .micro-tile, .guess-tile, .letter-box, span, div';
      const fallback = Array.from(asElement.querySelectorAll(selector));
      const seen = /* @__PURE__ */ new Set();
      const filtered = [];
      fallback.forEach((el) => {
        if (el === asElement || seen.has(el)) {
          return;
        }
        const status = this.getTileStatus(el);
        if (!status) {
          return;
        }
        seen.add(el);
        filtered.push(el);
      });
      return filtered;
    }
    convertTilesToGuessResults(tiles, expectedLength) {
      if (tiles.length === 0) {
        return null;
      }
      const row = [];
      let hasMeaningfulTile = false;
      tiles.forEach((tile) => {
        const status = this.getTileStatus(tile);
        if (!status) {
          return;
        }
        if (status !== "empty") {
          hasMeaningfulTile = true;
        }
        const letter = (tile.textContent || "").trim().slice(0, 1).toUpperCase();
        const normalizedStatus = status === "empty" ? "absent" : status;
        row.push({
          letter,
          status: normalizedStatus
        });
      });
      if (!hasMeaningfulTile) {
        return null;
      }
      if (expectedLength > 0 && row.length > expectedLength) {
        row.splice(expectedLength);
      } else if (expectedLength > 0 && row.length < expectedLength) {
        while (row.length < expectedLength) {
          row.push({
            letter: "",
            status: "absent"
          });
        }
      }
      return row;
    }
    detectBoardWordLength(boardEl, fallbackTileCount) {
      const asElement = boardEl;
      const dataLength = asElement.dataset && asElement.dataset.length ? parseInt(asElement.dataset.length, 10) : NaN;
      if (!Number.isNaN(dataLength) && dataLength > 0) {
        return dataLength;
      }
      const ariaColCount = boardEl.getAttribute("aria-colcount");
      const parsedAria = ariaColCount ? parseInt(ariaColCount, 10) : NaN;
      if (!Number.isNaN(parsedAria) && parsedAria > 0) {
        return parsedAria;
      }
      if (fallbackTileCount && fallbackTileCount > 0) {
        const potential = [5, 6, 7, 4];
        for (const length of potential) {
          if (fallbackTileCount % length === 0) {
            return length;
          }
        }
      }
      return 5;
    }
    getTileStatus(tile) {
      if (!(tile instanceof HTMLElement)) {
        return null;
      }
      const datasetState = tile.getAttribute("data-state") || tile.getAttribute("data-status");
      const datasetResult = this.normalizeTileStatus(datasetState);
      if (datasetResult) {
        return datasetResult;
      }
      const ariaLabel = tile.getAttribute("aria-label");
      const ariaResult = this.normalizeTileStatus(ariaLabel);
      if (ariaResult) {
        return ariaResult;
      }
      for (const cls of Array.from(tile.classList)) {
        const classResult = this.normalizeTileStatus(cls);
        if (classResult) {
          return classResult;
        }
      }
      const colorResult = this.getStatusFromComputedColor(tile);
      if (colorResult) {
        return colorResult;
      }
      const text = tile.textContent?.trim() || "";
      if (text.length === 0) {
        return "empty";
      }
      return "absent";
    }
    normalizeTileStatus(value) {
      if (!value || value.trim() === "") {
        return null;
      }
      const normalized = value.toLowerCase();
      if (normalized.includes("green")) {
        return "correct";
      }
      if (normalized.includes("yellow")) {
        return "present";
      }
      if (normalized.includes("gray") || normalized.includes("grey")) {
        return "absent";
      }
      if (normalized.includes("correct") || normalized.includes("exact") || normalized.includes("right")) {
        return "correct";
      }
      if (normalized.includes("present") || normalized.includes("misplaced") || normalized.includes("partial") || normalized.includes("close")) {
        return "present";
      }
      if (normalized.includes("absent") || normalized.includes("wrong") || normalized.includes("miss") || normalized.includes("incorrect") || normalized.includes("bad")) {
        return "absent";
      }
      if (normalized.includes("empty") || normalized.includes("unused") || normalized.includes("pending") || normalized.includes("tbd") || normalized.includes("unknown")) {
        return "empty";
      }
      return null;
    }
    getStatusFromComputedColor(tile) {
      try {
        const style = window.getComputedStyle(tile);
        const background = style.backgroundColor || tile.style.backgroundColor;
        const border = style.borderColor || tile.style.borderColor;
        const backgroundResult = this.mapColorToStatus(background);
        if (backgroundResult) {
          return backgroundResult;
        }
        const borderResult = this.mapColorToStatus(border);
        if (borderResult) {
          return borderResult;
        }
      } catch (error) {
        console.warn("[WordleBotScraper] Failed to read tile color", error);
      }
      return null;
    }
    mapColorToStatus(color) {
      if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
        return "empty";
      }
      const normalized = color.replace(/\s+/g, "").toLowerCase();
      if (normalized.includes("106,170,100") || normalized.includes("83,141,78") || normalized.includes("18,137,61")) {
        return "correct";
      }
      if (normalized.includes("201,180,88") || normalized.includes("181,159,59") || normalized.includes("197,180,88") || normalized.includes("212,180,88")) {
        return "present";
      }
      if (normalized.includes("120,124,126") || normalized.includes("58,58,60") || normalized.includes("68,70,74") || normalized.includes("100,117,128") || normalized.includes("134,138,142")) {
        return "absent";
      }
      return null;
    }
    renderGuessPatternToImage(pattern) {
      if (!pattern || pattern.length === 0) {
        return null;
      }
      const columns = Math.max(...pattern.map((row) => row.length));
      if (!columns) {
        return null;
      }
      const rows = pattern.length;
      const tileSize = 22;
      const gap = 4;
      const radius = 4;
      const width = columns * tileSize + (columns - 1) * gap;
      const height = rows * tileSize + (rows - 1) * gap;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.fillStyle = "#f3f2eb";
      ctx.fillRect(0, 0, width, height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = 'bold 14px "Clear Sans", "Helvetica Neue", Arial, sans-serif';
      pattern.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          const statusColor = this.getColorForStatus(cell.status);
          const letterColor = this.getLetterColorForStatus(cell.status);
          const letter = (cell.letter || "").toUpperCase();
          const x = colIndex * (tileSize + gap);
          const y = rowIndex * (tileSize + gap);
          this.fillRoundedRect(ctx, x, y, tileSize, tileSize, radius, statusColor);
          if (letter) {
            ctx.fillStyle = letterColor;
            ctx.fillText(letter, x + tileSize / 2, y + tileSize / 2 + 1);
          }
        });
      });
      try {
        return canvas.toDataURL("image/png");
      } catch (error) {
        console.warn("[WordleBotScraper] Failed to serialize board canvas", error);
        return null;
      }
    }
    getColorForStatus(status) {
      switch (status) {
        case "correct":
          return "#6aaa64";
        case "present":
          return "#c9b458";
        case "absent":
        default:
          return "#787c7e";
      }
    }
    getLetterColorForStatus(status) {
      switch (status) {
        case "correct":
        case "absent":
          return "#f8f8f8";
        case "present":
          return "#2f2f2f";
        default:
          return "#f8f8f8";
      }
    }
    fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    async loadMoreGames() {
      console.log("[WordleBotScraper] =====> loadMoreGames() called, searching for button...");
      const button = this.findShowMoreButton();
      if (!button) {
        console.log("[WordleBotScraper] =====> Load more button NOT FOUND - returning false");
        return false;
      }
      console.log("[WordleBotScraper] =====> Button found, checking if visible/enabled...");
      const style = window.getComputedStyle(button);
      const isHidden = style.display === "none" || style.visibility === "hidden";
      const isDisabled = button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true";
      if (isHidden || isDisabled) {
        console.log("[WordleBotScraper] =====> Load more button unavailable (hidden or disabled) - returning false");
        return false;
      }
      console.log("[WordleBotScraper] =====> Button is visible and enabled, clicking it...");
      const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      console.log(`[WordleBotScraper] Clicking load more button. Current cards: ${beforeCount}`);
      try {
        button.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (error) {
        console.warn("[WordleBotScraper] Failed to scroll load more button into view:", error);
      }
      button.click();
      await this.delay(50);
      const afterCount = await this.waitForCardIncrease(beforeCount, 6e3, 250);
      const newCards = afterCount - beforeCount;
      console.log(`[WordleBotScraper] After load more: ${afterCount} cards (${newCards} new)`);
      if (newCards > 0) {
        this.loadMoreNoGrowthAttempts = 0;
        return true;
      }
      this.loadMoreNoGrowthAttempts += 1;
      const stillHasButton = !!this.findShowMoreButton();
      if (stillHasButton && this.loadMoreNoGrowthAttempts < 3) {
        console.log("[WordleBotScraper] No new cards detected yet; polling again while button remains visible.");
        await this.delay(200);
        return true;
      }
      console.log("[WordleBotScraper] No additional cards after multiple attempts, stopping pagination.");
      return false;
    }
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async waitForCardIncrease(previousCount, maxWaitMs = 4e3, pollIntervalMs = 250) {
      let currentCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      const deadline = performance.now() + maxWaitMs;
      while (performance.now() < deadline) {
        if (currentCount > previousCount) {
          return currentCount;
        }
        await this.delay(pollIntervalMs);
        currentCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
      }
      return currentCount;
    }
    async waitForSelector(selector, timeoutMs = 5e3) {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (document.querySelector(selector)) {
          return true;
        }
        await this.delay(100);
      }
      return !!document.querySelector(selector);
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
        if (!text)
          continue;
        if (text.includes("show more") && text.includes("wordle")) {
          return candidate;
        }
      }
      return null;
    }
    async processAndSendGames(rawGames) {
      const startTime = performance.now();
      console.log(`[WordleBotScraper] =====> processAndSendGames called with ${rawGames.length} games`);
      this.sendProgress(rawGames.length, 0, "ready");
      const sortedGames = rawGames.sort((a, b) => {
        const aNum = a.gameNumber || 0;
        const bNum = b.gameNumber || 0;
        return bNum - aNum;
      });
      console.log(`[WordleBotScraper] =====> Converting ${rawGames.length} games to GameResult format...`);
      const convertStart = performance.now();
      const gameResults = sortedGames.map((raw) => this.convertToGameResult(raw));
      console.log(`[WordleBotScraper] =====> Conversion completed in ${(performance.now() - convertStart).toFixed(0)}ms`);
      const batchSize = 10;
      let imported = 0;
      let duplicates = 0;
      let errors = 0;
      console.log(`[WordleBotScraper] =====> Starting batch import loop (${Math.ceil(gameResults.length / batchSize)} batches)...`);
      for (let i = 0; i < gameResults.length; i += batchSize) {
        const batchStart = performance.now();
        const batch = gameResults.slice(i, i + batchSize);
        const processedSoFar = Math.min(i + batch.length, gameResults.length);
        const batchNum = Math.floor(i / batchSize) + 1;
        console.log(`[WordleBotScraper] =====> Batch ${batchNum}: Sending progress update (${processedSoFar}/${gameResults.length})`);
        this.sendProgress(
          gameResults.length,
          processedSoFar,
          "processing"
        );
        try {
          console.log(`[WordleBotScraper] =====> Batch ${batchNum}: Sending ${batch.length} games to background...`);
          const messageStart = performance.now();
          const response = await chrome.runtime.sendMessage({
            type: "BULK_IMPORT_GAMES",
            games: batch
          });
          const messageDuration = (performance.now() - messageStart).toFixed(0);
          console.log(`[WordleBotScraper] =====> Batch ${batchNum}: Background responded in ${messageDuration}ms:`, response);
          if (response.success) {
            imported += response.imported || 0;
            duplicates += response.duplicates || 0;
            errors += response.errors || 0;
          }
        } catch (error) {
          console.error(`[WordleBotScraper] Batch ${batchNum}: Error sending batch:`, error);
          errors += batch.length;
        }
        const batchDuration = (performance.now() - batchStart).toFixed(0);
        console.log(`[WordleBotScraper] =====> Batch ${batchNum}: Complete in ${batchDuration}ms (imported: ${imported}, duplicates: ${duplicates}, errors: ${errors})`);
      }
      console.log(`[WordleBotScraper] =====> All batches complete. Total duration: ${(performance.now() - startTime).toFixed(0)}ms`);
      if (gameResults.length > 0) {
        console.log(`[WordleBotScraper] =====> Sending final 'processed' progress update`);
        this.sendProgress(gameResults.length, gameResults.length, "processed");
      }
      console.log(`[WordleBotScraper] =====> Calling sendComplete: imported=${imported}, duplicates=${duplicates}, errors=${errors}, total=${sortedGames.length}`);
      this.sendComplete(imported, duplicates, errors, sortedGames);
      console.log(`[WordleBotScraper] =====> sendComplete called successfully`);
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
        ...raw.guessPattern && raw.guessPattern.length > 0 && { guessPattern: raw.guessPattern },
        ...raw.analysisUrl && { analysisUrl: raw.analysisUrl },
        scrapedFrom: "wordle-bot",
        source: "wordle-page",
        importedAt: now.toISOString(),
        wordLength: 5,
        maxGuesses: 6
      };
    }
    inferGameOutcome(game) {
      if (!game.solution || !game.guessPattern || game.guessPattern.length === 0) {
        return;
      }
      const normalizedSolution = game.solution.toUpperCase();
      const rowsWithLetters = game.guessPattern.map((row) => row.map((cell) => (cell.letter || "").toUpperCase())).map((letters, index) => ({
        letters,
        statuses: game.guessPattern[index].map((cell) => cell.status),
        hasLetters: letters.some((letter) => letter !== "")
      })).filter((row) => row.hasLetters);
      if (rowsWithLetters.length === 0) {
        return;
      }
      const finalRow = rowsWithLetters[rowsWithLetters.length - 1];
      const finalWord = finalRow.letters.join("");
      const allCorrect = finalRow.statuses.every((status) => status === "correct");
      if (!allCorrect) {
        return;
      }
      if (!finalWord || finalWord.length !== normalizedSolution.length) {
        return;
      }
      if (finalWord !== normalizedSolution) {
        return;
      }
      const turns = rowsWithLetters.length;
      if (turns === 0 || turns > 6) {
        return;
      }
      const existingSteps = typeof game.steps === "number" ? game.steps : 0;
      if (game.won === true && existingSteps === turns) {
        return;
      }
      game.won = true;
      game.steps = turns;
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
      console.log(`[WordleBotScraper] =====> sendComplete building message...`);
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
      console.log(`[WordleBotScraper] =====> Sending WORDLE_BOT_SCRAPE_COMPLETE message:`, message);
      let attempts = 0;
      const maxAttempts = 3;
      const sendWithRetry = async () => {
        for (let i = 0; i < maxAttempts; i++) {
          attempts++;
          console.log(`[WordleBotScraper] =====> Attempt ${attempts} to send completion message...`);
          try {
            const response = await chrome.runtime.sendMessage(message);
            console.log(`[WordleBotScraper] =====> Completion message sent successfully on attempt ${attempts}, response:`, response);
            return;
          } catch (error) {
            console.error(`[WordleBotScraper] =====> ERROR on attempt ${attempts}:`, error);
            if (i < maxAttempts - 1) {
              console.log(`[WordleBotScraper] =====> Retrying in 500ms...`);
              await this.delay(500);
            }
          }
        }
        console.error(`[WordleBotScraper] =====> FAILED to send completion message after ${maxAttempts} attempts`);
      };
      sendWithRetry();
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
