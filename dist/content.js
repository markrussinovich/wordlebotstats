var WordleContent = (() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => {
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
    return value;
  };

  // src/extension/content/wordleContent.ts
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
