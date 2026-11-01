var WordleContent = (() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => {
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    return value;
  };

  // src/types/playTypes.ts
  function localPuzzleDate(now = /* @__PURE__ */ new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  function playStatus(rows) {
    if (rows.some(
      (row) => row.length === 5 && row.every((cell) => cell.status === "correct")
    ))
      return "won";
    return rows.length >= 6 ? "lost" : "playing";
  }

  // src/extension/content/wordlePlay.ts
  var loadedDate = localPuzzleDate();
  var queue = Promise.resolve();
  var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function boardTiles() {
    const board = document.querySelector(
      '[data-testid="board"], [class*="Board-module_board"], [role="grid"]'
    );
    return board ? Array.from(
      board.querySelectorAll(
        '[data-testid="tile"], [data-state]'
      )
    ).filter(
      (tile) => ["empty", "tbd", "correct", "present", "absent"].includes(
        tile.dataset.state || ""
      )
    ) : [];
  }
  function readNytRows() {
    const tiles = boardTiles();
    if (tiles.length !== 30)
      throw new Error("NYT is not ready. Open its tab and finish any prompts.");
    const rows = [];
    for (let index = 0; index < 30; index += 5) {
      const row = tiles.slice(index, index + 5);
      if (!row.every(
        (tile) => ["correct", "present", "absent"].includes(tile.dataset.state || "")
      ))
        break;
      rows.push(
        row.map((tile) => ({
          letter: (tile.textContent || "").trim().toUpperCase(),
          status: tile.dataset.state
        }))
      );
    }
    return rows;
  }
  function keyButton(key) {
    const button = document.querySelector(
      `button[data-key="${key}"]`
    );
    if (!button || button.disabled)
      throw new Error("NYT keyboard is unavailable. Open its tab to continue.");
    return button;
  }
  function checkOverlays() {
    const dialog = document.querySelector(
      '[role="dialog"], [aria-modal="true"]'
    );
    if (dialog && dialog.getClientRects().length)
      throw new Error("Open NYT and dismiss its dialog before continuing here.");
  }
  async function dismissHelp() {
    const help = document.querySelector(
      '#help-dialog, [aria-label="help Modal"]'
    );
    if (help && /How To Play/i.test(help.textContent || "")) {
      help.querySelector('button[aria-label="Close"]')?.click();
      for (let attempt = 0; attempt < 3 && help.isConnected; attempt++) {
        await delay(100);
        finishAnimations(help);
        const closing = help.querySelector('[class*="Modal-module_closing"]');
        if (closing)
          closing.dispatchEvent(
            new AnimationEvent("animationend", {
              bubbles: true,
              animationName: getComputedStyle(closing).animationName
            })
          );
      }
    }
  }
  function finishAnimations(element) {
    for (const animation of element?.getAnimations?.({ subtree: true }) || []) {
      if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) {
        try {
          animation.finish();
        } catch {
        }
      }
    }
  }
  async function prepareGame() {
    const deadline = Date.now() + 6e4;
    while (Date.now() < deadline) {
      if (boardTiles().length === 30) {
        await delay(500);
        await dismissHelp();
        return;
      }
      const start = document.querySelector(
        'button[data-testid="Play"]'
      );
      const continuation = Array.from(
        document.querySelectorAll("button")
      ).find(
        (button) => /^Continue to Wordle/.test(button.textContent?.trim() || "")
      );
      if (start && !start.disabled)
        start.click();
      if (continuation && !continuation.disabled && continuation.getAttribute("aria-disabled") !== "true")
        continuation.click();
      await delay(300);
    }
    throw new Error(
      "NYT is not ready. Open its tab, finish any prompts, then reconnect."
    );
  }
  async function handleNytPlay(message) {
    if (message.date !== loadedDate || loadedDate !== localPuzzleDate())
      throw new Error(
        "The daily puzzle changed. Reload the NYT tab before connecting."
      );
    if (message.type === "NYT_PLAY_STATE" /* NYT_PLAY_STATE */) {
      if (message.prepare)
        await prepareGame();
      return { success: true, rows: readNytRows() };
    }
    await dismissHelp();
    checkOverlays();
    const toastDeadline = Date.now() + 1e4;
    while (visibleToast()) {
      if (Date.now() >= toastDeadline)
        throw new Error(
          "Wait for NYT's current message to clear before submitting."
        );
      await delay(100);
    }
    const rows = readNytRows();
    const guess = message.guess;
    if (!/^[A-Z]{5}$/.test(guess || ""))
      throw new Error("Enter a five-letter word.");
    if (message.expectedRows !== rows.length)
      return {
        success: false,
        rows,
        error: "NYT changed. Review the synchronized board before submitting again."
      };
    if (playStatus(rows) !== "playing")
      return {
        success: false,
        rows,
        error: "Today's official game is already finished."
      };
    const pending = boardTiles().slice(rows.length * 5, rows.length * 5 + 5);
    if (pending.some((tile) => tile.textContent?.trim()))
      throw new Error(
        "There is an unfinished guess in NYT. Finish or clear it there before submitting here."
      );
    for (const letter of guess.toLowerCase()) {
      keyButton(letter).click();
      await delay(0);
    }
    const entered = boardTiles().slice(rows.length * 5, rows.length * 5 + 5).map((tile) => tile.textContent?.trim().toUpperCase()).join("");
    if (entered !== guess)
      throw new Error(
        "NYT did not accept the keyboard input. Open its tab to continue."
      );
    keyButton("\u21B5").click();
    const deadline = Date.now() + 1e4;
    while (Date.now() < deadline) {
      finishAnimations(
        document.querySelector(
          '[data-testid="board"], [class*="Board-module_board"]'
        )
      );
      const updated = readNytRows();
      if (updated.length > rows.length)
        return { success: true, rows: updated };
      const toast = visibleToast();
      if (toast) {
        const error = toast.textContent.trim();
        for (let index = 0; index < 5; index++) {
          keyButton("\u2190").click();
          await delay(0);
        }
        return { success: false, invalidGuess: true, rows, error };
      }
      await delay(100);
    }
    return {
      success: false,
      rows: readNytRows(),
      error: "NYT has not confirmed this guess. Reconnect before trying again."
    };
  }
  function visibleToast() {
    const toast = document.querySelector(
      '[data-testid="toast"], [class*="Toast-module_toast"]'
    );
    return toast?.textContent?.trim() && toast.getClientRects().length ? toast : null;
  }
  function installWordlePlay() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type !== "NYT_PLAY_STATE" /* NYT_PLAY_STATE */ && message.type !== "NYT_PLAY_GUESS" /* NYT_PLAY_GUESS */)
        return false;
      const operation = queue.then(() => handleNytPlay(message));
      queue = operation.catch(() => void 0);
      operation.then(sendResponse).catch(
        (error) => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "NYT could not process the request."
        })
      );
      return true;
    });
  }

  // src/extension/content/wordleContent.ts
  installWordlePlay();
  var WordleIntegration = class {
    constructor() {
      __publicField(this, "observer", null);
      __publicField(this, "isInitialized", false);
      __publicField(this, "lastProcessedDate", null);
      this.init();
    }
    async init() {
      if (this.isInitialized)
        return;
      console.log("[WordleContent] Initializing Wordle integration...");
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.setupIntegration());
      } else {
        this.setupIntegration();
      }
      this.isInitialized = true;
    }
    setupIntegration() {
      if (!this.isWordlePage()) {
        console.log("[WordleContent] Not on Wordle page, integration disabled");
        return;
      }
      console.log("[WordleContent] Setting up Wordle page integration");
      this.startGameMonitoring();
      this.checkExistingGame();
    }
    isWordlePage() {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      return hostname === "www.nytimes.com" && pathname.includes("/games/wordle") || hostname === "www.powerlanguage.co.uk" && pathname.includes("/wordle") || hostname.includes("wordle");
    }
    startGameMonitoring() {
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" || mutation.type === "attributes") {
            this.checkForGameCompletion();
          }
        });
      });
      const gameContainer = document.querySelector('[data-testid="App-module_gameContainer"]') || document.querySelector("#wordle-app-game") || document.querySelector(".Game-module_game");
      if (gameContainer) {
        this.observer.observe(gameContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "data-state", "aria-label"]
        });
      } else {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      console.log("[WordleContent] Game monitoring started");
    }
    checkExistingGame() {
      setTimeout(() => {
        this.checkForGameCompletion();
      }, 1e3);
    }
    async checkForGameCompletion() {
      try {
        const gameState = this.detectGameState();
        if (gameState && gameState.isComplete) {
          if (this.lastProcessedDate === gameState.date) {
            return;
          }
          console.log("[WordleContent] Game completed detected:", gameState);
          const gameResult = this.convertToGameResult(gameState);
          await this.sendGameResult(gameResult);
          this.lastProcessedDate = gameState.date;
        }
      } catch (error) {
        console.error("[WordleContent] Error checking game completion:", error);
      }
    }
    detectGameState() {
      try {
        const completionModal = document.querySelector('[data-testid="toast"]') || document.querySelector(".Toast-module_toast") || document.querySelector(".game-modal");
        const gameBoard = this.getGameBoard();
        if (!gameBoard)
          return null;
        const rows = gameBoard.querySelectorAll('[data-testid^="row"]') || gameBoard.querySelectorAll(".Row-module_row") || gameBoard.querySelectorAll('div[role="grid"] > div');
        if (rows.length === 0)
          return null;
        let guesses = 0;
        let isComplete = false;
        let isWon = false;
        Array.from(rows).forEach((row, index) => {
          const tiles = row.querySelectorAll('[data-testid^="tile"]') || row.querySelectorAll(".Tile-module_tile") || row.querySelectorAll("div[data-state]");
          if (tiles.length === 0)
            return;
          const rowHasContent = Array.from(tiles).some((tile) => {
            const letter = tile.textContent?.trim();
            return letter && letter.length > 0;
          });
          if (rowHasContent) {
            guesses++;
            const allTilesComplete = Array.from(tiles).every((tile) => {
              const state = tile.getAttribute("data-state") || tile.getAttribute("aria-label") || this.getTileStateFromClass(tile);
              return state && (state.includes("correct") || state.includes("present") || state.includes("absent") || state === "correct" || state === "present" || state === "absent");
            });
            if (allTilesComplete) {
              const allCorrect = Array.from(tiles).every((tile) => {
                const state = tile.getAttribute("data-state") || this.getTileStateFromClass(tile);
                return state === "correct" || state?.includes("correct");
              });
              if (allCorrect) {
                isComplete = true;
                isWon = true;
                return;
              }
              if (index === rows.length - 1) {
                isComplete = true;
                isWon = false;
              }
            }
          }
        });
        if (!isComplete) {
          const shareButton = document.querySelector('[data-testid="share-button"]') || document.querySelector('button[aria-label*="Share"]') || document.querySelector(".ShareButton");
          if (shareButton || completionModal && completionModal.textContent) {
            isComplete = true;
            const modalText = completionModal?.textContent?.toLowerCase() || "";
            if (modalText.includes("congratulations") || modalText.includes("genius") || modalText.includes("magnificent") || modalText.includes("impressive") || modalText.includes("splendid") || modalText.includes("great") || modalText.includes("phew")) {
              isWon = true;
            }
          }
        }
        if (!isComplete)
          return null;
        return {
          isComplete,
          isWon,
          guesses: isWon ? guesses : 0,
          // Only count guesses if won
          maxGuesses: rows.length,
          date: this.getCurrentGameDate(),
          gameNumber: this.getGameNumber()
        };
      } catch (error) {
        console.error("[WordleContent] Error detecting game state:", error);
        return null;
      }
    }
    getGameBoard() {
      return document.querySelector('[data-testid="board"]') || document.querySelector(".Board-module_board") || document.querySelector("#board") || document.querySelector('div[role="grid"]') || document.querySelector(".game-board");
    }
    getTileStateFromClass(tile) {
      const classList = Array.from(tile.classList);
      if (classList.some((cls) => cls.includes("correct") || cls.includes("green"))) {
        return "correct";
      }
      if (classList.some((cls) => cls.includes("present") || cls.includes("yellow"))) {
        return "present";
      }
      if (classList.some((cls) => cls.includes("absent") || cls.includes("gray") || cls.includes("grey"))) {
        return "absent";
      }
      return null;
    }
    getCurrentGameDate() {
      const today = /* @__PURE__ */ new Date();
      return today.toISOString().split("T")[0];
    }
    getGameNumber() {
      const titleElement = document.querySelector("h1") || document.querySelector("title");
      const titleText = titleElement?.textContent || document.title;
      const match = titleText.match(/wordle\s*#?(\d+)/i);
      return match ? parseInt(match[1], 10) : void 0;
    }
    convertToGameResult(gameState) {
      const now = /* @__PURE__ */ new Date();
      return {
        gameId: `${gameState.date}-${gameState.gameNumber || "unknown"}`,
        date: gameState.date,
        won: gameState.isWon,
        attempts: gameState.guesses,
        guesses: gameState.guesses,
        maxGuesses: gameState.maxGuesses,
        duration: 0,
        // We can't reliably measure duration from the page
        wordLength: 5,
        // Wordle is always 5 letters
        gameNumber: gameState.gameNumber,
        source: "wordle-page",
        importedAt: now.toISOString(),
        guessDistribution: [],
        // Could be enhanced to extract actual guesses
        hardMode: false
        // Could be detected from game settings
      };
    }
    async sendGameResult(gameResult) {
      try {
        const message = {
          type: "IMPORT_GAME_RESULT" /* IMPORT_GAME_RESULT */,
          gameResult,
          source: "content-script",
          timestamp: Date.now()
        };
        const response = await chrome.runtime.sendMessage(message);
        if (response?.success) {
          console.log("[WordleContent] Game result sent successfully:", gameResult);
          this.showImportNotification(gameResult);
        } else {
          console.error("[WordleContent] Failed to send game result:", response?.error);
        }
      } catch (error) {
        console.error("[WordleContent] Error sending game result:", error);
      }
    }
    showImportNotification(gameResult) {
      const notification = document.createElement("div");
      notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #6aaa64;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
    `;
      const resultText = gameResult.won ? `Wordle solved in ${gameResult.guesses}! \u{1F389}` : "Wordle attempt recorded \u{1F4CA}";
      notification.textContent = `${resultText} Stats updated.`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.transform = "translateX(0)";
      }, 100);
      setTimeout(() => {
        notification.style.transform = "translateX(100%)";
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3e3);
    }
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.isInitialized = false;
    }
  };
  var wordleIntegration = new WordleIntegration();
  window.addEventListener("beforeunload", () => {
    wordleIntegration.destroy();
  });
  if (typeof window !== "undefined") {
    window.__wordleIntegration = wordleIntegration;
  }
})();
