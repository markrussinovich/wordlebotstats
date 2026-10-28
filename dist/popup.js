(() => {
  // src/dashboard/theme.ts
  (() => {
    const param = new URLSearchParams(window.location.search).get("scoutTheme");
    const theme = param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();

  // src/solver/solver.ts
  var SOLVER_VERSION = "3-12dicts-5ef55f9-wordfreq-372f6db-raise";
  var SOLVER_DESCRIPTION = "Normal mode, fixed RAISE opener, common answers from public-domain 12Dicts and probabilities from wordfreq. Uses entropy-based expected-turn estimates and exact search when 8 or fewer candidates remain or two turns are left, prioritizing solving within six turns. Falls back to the wider dictionary when feedback rules out common answers. Not NYT WordleBot or a globally optimal solver; results may differ.";

  // src/utils/solveComparison.ts
  function userTurns(game) {
    const attempts = game.attempts ?? game.guesses;
    if (!attempts || attempts < 1)
      return game.completed && !game.won ? 7 : null;
    return game.won && attempts <= 6 ? attempts : 7;
  }

  // src/extension/popup/popup.js
  console.log("[Popup] Popup script loading...");
  document.addEventListener("DOMContentLoaded", function() {
    console.log("[Popup] DOM loaded, initializing popup...");
    const container = document.getElementById("popup-root");
    if (!container) {
      console.error("[Popup] popup-root container not found");
      return;
    }
    let selectedTimeFrame = "7d";
    let isLoading = false;
    let statistics = null;
    let lastGame = null;
    let allGames = [];
    let currentGameIndex = 0;
    let scraperStatus = {
      active: false,
      message: ""
    };
    let activeNotification = null;
    const solverCacheKey = `solver-${SOLVER_VERSION}`;
    let solverResults = {};
    let solverWorker = null;
    let solverError = null;
    let showSolverSolution = false;
    let cacheWrites = Promise.resolve();
    let readerFetchRunning = false;
    const attemptedReaders = /* @__PURE__ */ new Set();
    const solverCacheReady = chrome.storage.local.get(solverCacheKey).then((value) => {
      solverResults = value[solverCacheKey] || {};
    }).catch(() => {
    });
    window.addEventListener("pagehide", () => solverWorker?.terminate());
    async function calculateReaderAverages() {
      if (readerFetchRunning)
        return;
      readerFetchRunning = true;
      try {
        const current = allGames[currentGameIndex];
        for (const game of [current, ...allGames]) {
          if (!game?.solution || game.nytReaderSource === "manual")
            continue;
          const key = `${game.date}:${game.hardMode}`;
          if (attemptedReaders.has(key))
            continue;
          attemptedReaders.add(key);
          try {
            const response = await chrome.runtime.sendMessage({
              type: "GET_NYT_READER_AVERAGE",
              date: game.date
            });
            if (response?.success && response.game) {
              allGames = allGames.map((item) => item.date === game.date ? response.game : item);
              render();
            }
          } catch (error) {
            console.warn("[Popup] Reader average unavailable:", error);
          }
        }
      } finally {
        readerFetchRunning = false;
      }
    }
    async function calculateSolverResults() {
      await solverCacheReady;
      if (solverWorker || solverError)
        return;
      const current = allGames[currentGameIndex];
      const solutions = [...new Set([current, ...allGames].flatMap((game) => game?.solution ? [game.solution.trim().toUpperCase()] : []))].filter((solution) => !solverResults[solution]);
      if (!solutions.length) {
        render();
        return;
      }
      try {
        solverWorker = new Worker(chrome.runtime.getURL("solver.worker.js"), { type: "module" });
        const fail = (message) => {
          solverError = message;
          solverWorker?.terminate();
          solverWorker = null;
          render();
        };
        solverWorker.onerror = () => fail("Solver could not run. Reopen the popup to retry.");
        solverWorker.onmessage = ({ data }) => {
          if (data.solution && data.result) {
            solverResults[data.solution] = data.result;
            cacheWrites = cacheWrites.then(async () => {
              const stored = await chrome.storage.local.get(solverCacheKey);
              await chrome.storage.local.set({
                [solverCacheKey]: { ...stored[solverCacheKey], ...solverResults }
              });
            }).catch((error) => console.warn("[Popup] Solver cache could not be saved:", error));
            render();
          }
          if (data.error)
            fail(data.error);
          else if (data.complete) {
            solverWorker.terminate();
            solverWorker = null;
            calculateSolverResults();
          }
        };
        solverWorker.postMessage(solutions);
      } catch (error) {
        solverError = "Solver could not start. Reopen the popup to retry.";
        solverWorker?.terminate();
        solverWorker = null;
        console.error("[Popup] Solver failed:", error);
        render();
      }
    }
    const STORAGE_KEYS = {
      CURRENT_GAME_INDEX: "popup_current_game_index",
      LAST_GAMES_COUNT: "popup_last_games_count"
    };
    function render() {
      const timeFrames = ["7d", "30d", "90d", "all"];
      container.innerHTML = `
      <div class="popup-container">
        <header class="popup-header">
          <div class="popup-header-top">
            <h1>Wordle Stats</h1>
            <button class="refresh-btn" id="refresh-btn" ${scraperStatus.active ? "disabled" : ""}>
              \u21BB Refresh
            </button>
          </div>
        </header>
        
        <main class="popup-main">
          ${renderGameViewer()}
          
          <div class="time-frame-picker">
            ${timeFrames.map((tf) => `
              <button 
                class="time-frame-btn ${selectedTimeFrame === tf ? "active" : ""}"
                data-timeframe="${tf}"
              >
                ${tf.toUpperCase()}
              </button>
            `).join("")}
          </div>
          
          ${renderContent()}
        </main>
        
        <footer class="popup-footer">
          <button class="dashboard-link" id="dashboard-btn" ${isLoading || scraperStatus.active ? "disabled" : ""}>
            Dashboard
          </button>
        </footer>
      </div>
    `;
      attachEventListeners();
    }
    function renderContent() {
      const notifications = renderNotification();
      if (scraperStatus.active) {
        return `
        ${notifications}
        ${renderLoadingState(scraperStatus.message || "Working...")}
      `;
      }
      if (isLoading) {
        return `
        ${notifications}
        ${renderLoadingState("Loading stats...")}
      `;
      }
      if (!statistics) {
        return `
        ${notifications}
        <div class="empty-state">
          <div class="empty-icon">\u{1F4C4}</div>
          <div class="empty-title">No Wordle data yet</div>
          <div class="empty-message">Play a game or import your history to see stats here.</div>
        </div>
      `;
      }
      const streakLabel = selectedTimeFrame === "7d" ? "Current Streak" : "Longest Streak";
      const streakValue = selectedTimeFrame === "7d" ? statistics.currentStreak : statistics.maxStreak;
      return `
      ${notifications}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${statistics.winRate.toFixed(1)}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${statistics.averageGuesses.toFixed(2)}</div>
          <div class="stat-label">Avg Guesses</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${streakValue}</div>
          <div class="stat-label">${streakLabel}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${statistics.gameCount}</div>
          <div class="stat-label">Games Played</div>
        </div>
      </div>
    `;
    }
    function attachEventListeners() {
      document.querySelectorAll(".time-frame-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          selectedTimeFrame = e.target.dataset.timeframe;
          loadStatistics();
        });
      });
      const dashboardBtn = document.getElementById("dashboard-btn");
      if (dashboardBtn) {
        dashboardBtn.addEventListener("click", () => {
          if (dashboardBtn.disabled) {
            return;
          }
          dashboardBtn.disabled = true;
          chrome.runtime.sendMessage({
            type: "OPEN_DASHBOARD_TAB"
          }).catch((err) => {
            console.error("[Popup] Failed to reuse dashboard tab, opening new one:", err);
            const fallbackUrl = chrome.runtime.getURL("dashboard.html");
            chrome.tabs.create({ url: fallbackUrl });
          }).finally(() => {
            window.close();
          });
        });
      }
      const refreshBtn = document.getElementById("refresh-btn");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
          if (!refreshBtn.disabled) {
            render();
            const didGapFill = await checkAndFillGaps();
            if (!didGapFill) {
              triggerIncrementalScrape();
            }
          }
        });
      }
      const prevBtn = document.getElementById("prev-game-btn");
      const nextBtn = document.getElementById("next-game-btn");
      if (prevBtn) {
        prevBtn.addEventListener("click", async () => {
          if (currentGameIndex < allGames.length - 1) {
            currentGameIndex++;
            showSolverSolution = false;
            await saveCurrentGameIndex();
            render();
          }
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
          if (currentGameIndex > 0) {
            currentGameIndex--;
            showSolverSolution = false;
            await saveCurrentGameIndex();
            render();
          }
        });
      }
      const latestBtn = document.getElementById("latest-game-btn");
      if (latestBtn) {
        latestBtn.addEventListener("click", async () => {
          currentGameIndex = 0;
          showSolverSolution = false;
          await saveCurrentGameIndex();
          render();
        });
      }
      const dismissBtn = document.querySelector("[data-dismiss-notification]");
      if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
          activeNotification = null;
          render();
        });
      }
      document.getElementById("solver-solution-btn")?.addEventListener("click", () => {
        showSolverSolution = !showSolverSolution;
        render();
      });
    }
    async function loadStatistics() {
      try {
        console.log("[Popup] Loading statistics for:", selectedTimeFrame);
        const [statsResponse, gamesResponse] = await Promise.all([
          chrome.runtime.sendMessage({
            type: "GET_QUICK_STATS",
            timeFrame: selectedTimeFrame
          }),
          chrome.runtime.sendMessage({
            type: "GET_DASHBOARD_DATA"
          })
        ]);
        console.log("[Popup] Statistics response:", statsResponse);
        console.log("[Popup] Games response:", gamesResponse);
        if (statsResponse && statsResponse.success) {
          statistics = statsResponse.statistics;
          lastGame = statsResponse.lastGame || null;
          console.log("[Popup] \u2705 Statistics loaded successfully:", statistics);
          console.log("[Popup] \u2705 Last game:", lastGame);
        } else {
          console.error("[Popup] Failed to load statistics:", statsResponse);
          statistics = null;
          lastGame = null;
        }
        if (gamesResponse && gamesResponse.success && gamesResponse.games) {
          const previousGamesCount = allGames.length;
          allGames = [...gamesResponse.games].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          if (previousGamesCount === 0) {
            await loadCurrentGameIndex();
          }
          if (currentGameIndex >= allGames.length) {
            currentGameIndex = Math.max(0, allGames.length - 1);
          }
          console.log("[Popup] \u2705 All games loaded:", allGames.length, "Current index:", currentGameIndex);
        } else {
          console.error("[Popup] Failed to load games:", gamesResponse);
          allGames = [];
        }
      } catch (error) {
        console.error("[Popup] Error loading statistics:", error);
        statistics = null;
        lastGame = null;
      } finally {
        render();
        calculateSolverResults();
        calculateReaderAverages();
      }
    }
    chrome.runtime.onMessage.addListener((message) => {
      console.log("[Popup] Received message:", message);
      if (message.type === "WORDLE_BOT_SCRAPE_PROGRESS") {
        scraperStatus.active = true;
        if (message.status && !message.status.match(/^(scanning|loading|processing)$/)) {
          scraperStatus.message = message.status;
        } else if (message.gamesFound > 0) {
          scraperStatus.message = `Found ${message.gamesFound} games...`;
        } else {
          scraperStatus.message = "Starting...";
        }
        render();
      } else if (message.type === "WORDLE_BOT_SCRAPE_COMPLETE") {
        scraperStatus.active = false;
        scraperStatus.message = "";
        if (message.errors > 0) {
          const partial = (message.newGames || 0) + (message.duplicates || 0) > 0;
          activeNotification = {
            id: "scrape-incomplete",
            type: partial ? "warning" : "error",
            title: partial ? "History import incomplete" : "History import failed",
            message: `${message.errors} game${message.errors === 1 ? "" : "s"} could not be imported. Refresh to retry.`,
            icon: "\u26A0\uFE0F"
          };
        } else
          activeNotification = null;
        console.log(`[Popup] Scrape complete - ${message.newGames} new games, ${message.totalGames} total checked`);
        if (message.newGames > 0) {
          currentGameIndex = 0;
          showSolverSolution = false;
          saveCurrentGameIndex();
          console.log("[Popup] Reset to newest game due to new games found");
        }
        loadStatistics();
      } else if (message.type === "WORDLE_BOT_SCRAPE_ERROR") {
        scraperStatus.active = false;
        scraperStatus.message = "";
        console.error("[Popup] Scrape error:", message.error);
        if (message.code === "AUTH_REQUIRED") {
          activeNotification = {
            id: "nyt-login-required",
            type: "error",
            title: "Sign in required",
            message: message.error || "Please sign in to your NYTimes account and try again.",
            icon: "\u{1F512}"
          };
          render();
        } else if (message.error) {
          activeNotification = {
            id: "scrape-error",
            type: "error",
            title: "Import failed",
            message: message.error,
            icon: "\u26A0\uFE0F"
          };
          render();
        }
      }
      return false;
    });
    async function triggerAutoImport(fillGaps = false) {
      try {
        console.log(`[Popup] Triggering auto-import from WordleBot (fillGaps: ${fillGaps})`);
        activeNotification = null;
        scraperStatus.active = true;
        scraperStatus.message = fillGaps ? "Filling gaps in game history..." : "Checking for new games...";
        render();
        const response = await chrome.runtime.sendMessage({
          type: "START_WORDLE_BOT_SCRAPE",
          mode: fillGaps ? "full" : "auto",
          maxIterations: 200
        });
        console.log("[Popup] Auto-import response:", response);
        if (response && (response.skipped || !response.success)) {
          scraperStatus.active = false;
          scraperStatus.message = "";
          render();
          console.log("[Popup] Scraping skipped or failed:", response.reason || "unknown");
        }
      } catch (error) {
        console.error("[Popup] Auto-import failed:", error);
        scraperStatus.active = false;
        scraperStatus.message = "";
        render();
      }
    }
    async function triggerIncrementalScrape() {
      try {
        console.log("[Popup] Triggering incremental scrape for new games");
        activeNotification = null;
        scraperStatus.active = true;
        scraperStatus.message = "Checking for new games...";
        render();
        const response = await chrome.runtime.sendMessage({
          type: "START_WORDLE_BOT_SCRAPE",
          mode: "incremental",
          maxIterations: 200
        });
        console.log("[Popup] Incremental scrape response:", response);
        if (response && !response.success) {
          scraperStatus.active = false;
          scraperStatus.message = "";
          render();
          console.log("[Popup] Scraping failed:", response.reason || "unknown");
        }
      } catch (error) {
        console.error("[Popup] Incremental scrape failed:", error);
        scraperStatus.active = false;
        scraperStatus.message = "";
        render();
      }
    }
    function detectLargestGap(games) {
      if (games.length < 2)
        return { gapDays: 0 };
      const dates = games.map((g) => g.date).filter((d) => d).sort();
      let largestGap = 0;
      let gapStart = null;
      let gapEnd = null;
      for (let i = 1; i < dates.length; i++) {
        const prev = /* @__PURE__ */ new Date(dates[i - 1] + "T00:00:00");
        const curr = /* @__PURE__ */ new Date(dates[i] + "T00:00:00");
        const diffDays = Math.round((curr - prev) / (1e3 * 60 * 60 * 24));
        if (diffDays > largestGap) {
          largestGap = diffDays;
          gapStart = dates[i - 1];
          gapEnd = dates[i];
        }
      }
      return { gapDays: largestGap, gapStart, gapEnd };
    }
    async function checkAndFillGaps() {
      try {
        const result = await chrome.storage.local.get(["games"]);
        const games = result.games || [];
        if (games.length < 2)
          return false;
        const { gapDays, gapStart, gapEnd } = detectLargestGap(games);
        console.log(`[Popup] Largest gap: ${gapDays} days (${gapStart} \u2192 ${gapEnd})`);
        if (gapDays > 1) {
          console.log(`[Popup] Significant gap detected (${gapDays} days), triggering full scrape to fill`);
          await triggerAutoImport(true);
          return true;
        }
        return false;
      } catch (error) {
        console.error("[Popup] Error checking for gaps:", error);
        return false;
      }
    }
    async function checkAndTriggerAutoImport() {
      try {
        const result = await chrome.storage.local.get(["games"]);
        const games = result.games || [];
        console.log(`[Popup] Found ${games.length} games in storage`);
        if (games.length === 0) {
          console.log("[Popup] No games found, triggering auto-import");
          triggerAutoImport();
        }
      } catch (error) {
        console.error("[Popup] Error checking for auto-import:", error);
      }
    }
    loadStatistics();
    checkAndTriggerAutoImport();
    function renderNotification() {
      if (!activeNotification) {
        return "";
      }
      const icon = activeNotification.icon || "\u2139\uFE0F";
      const title = escapeHtml(activeNotification.title || "Notice");
      const message = escapeHtml(activeNotification.message || "");
      if (activeNotification.type === "warning") {
        return `
        <div class="notification warning" role="status" title="${title}">
          <span aria-hidden="true">\u26A0</span>
          <span class="notification-message">${message}</span>
          <button class="notification-dismiss" data-dismiss-notification aria-label="Dismiss notification">\u2715</button>
        </div>
      `;
      }
      return `
      <div class="notification ${activeNotification.type}" role="alert">
        <div class="notification-icon">${icon}</div>
        <div class="notification-body">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
        </div>
        <button class="notification-dismiss" data-dismiss-notification aria-label="Dismiss notification">\u2715</button>
      </div>
    `;
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]);
    }
    function renderLoadingState(message) {
      return `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
      </div>
    `;
    }
    function renderGameViewer() {
      if (!allGames || allGames.length === 0) {
        return `
        <div class="game-viewer">
          <div class="game-viewer-content">
            <div class="no-games-message">No games available</div>
          </div>
        </div>
      `;
      }
      const currentGame = allGames[currentGameIndex] || null;
      if (!currentGame) {
        return `
        <div class="game-viewer">
          <div class="game-viewer-content">
            <div class="no-games-message">No game selected</div>
          </div>
        </div>
      `;
      }
      const dateParts = currentGame.date.split("-");
      const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      const formattedDate = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      const word = currentGame.solution || "\u2014";
      const hasScores = currentGame.skillScore !== void 0 && currentGame.luckScore !== void 0;
      const readerAverage = currentGame.nytReaderAverage;
      const hasReaderAverage = Number.isFinite(readerAverage) && readerAverage >= 1 && readerAverage <= 7;
      const solver = solverResults[currentGame.solution?.trim().toUpperCase()];
      const solverTurns = solver?.status === "solved" ? solver.turns : solver?.status === "failed" ? "X/6" : solver || solverError || !currentGame.solution ? "N/A" : "...";
      const solverTitle = escapeHtml(solverError || (solver?.status === "unavailable" ? "This answer is outside the bundled solver dictionary." : SOLVER_DESCRIPTION));
      const showSolverBoard = showSolverSolution && solver?.guesses?.length > 0;
      const userTurns2 = userTurns(currentGame);
      const userTurnCount = userTurns2 === 7 ? "X/6" : userTurns2 ?? "N/A";
      const solverTurnCount = solver?.status === "failed" ? 7 : solver?.status === "solved" ? solver.turns : null;
      const comparison = userTurns2 === null || solverTurnCount === null ? "unavailable" : solverTurnCount < userTurns2 ? "solver-better" : solverTurnCount === userTurns2 ? "tie" : "user-better";
      const comparisonDescription = {
        "solver-better": "The solver uses fewer turns than you.",
        tie: "You and the solver use the same number of turns.",
        "user-better": "You use fewer turns than the solver.",
        unavailable: "Turn comparison is unavailable."
      }[comparison];
      const wordClass = (showSolverBoard ? solver.status === "solved" : currentGame.won) ? "" : " lost";
      const gameBoard = renderGameBoard(
        showSolverBoard ? { guessPattern: solver.guesses.map((guess) => guess.feedback) } : currentGame,
        showSolverBoard ? "Local solver board" : "Your game board"
      );
      const nextNav = `
      <div class="next-nav">
        <button class="nav-btn nav-btn-large" id="next-game-btn" aria-label="Next game" ${currentGameIndex <= 0 ? "disabled" : ""}>
          \u203A
        </button>
        ${currentGameIndex > 0 ? `
          <button class="nav-btn latest-game-btn" id="latest-game-btn" aria-label="Jump to most recent game" title="Jump to most recent game">
            \xBB
          </button>
        ` : ""}
      </div>
    `;
      return `
      <div class="game-viewer">
        <div class="game-info">
          <div class="game-date">${formattedDate}</div>

        </div>
        
        <div class="game-viewer-content">
          <div class="game-word${wordClass}">${word.toUpperCase()}</div>
          <div class="game-board-mode" data-mode="${showSolverBoard ? "solver" : "user"}"
            title="${showSolverBoard ? solverTitle : "Your played guesses"}">
            ${showSolverBoard ? "Local solver (normal mode)" : "Your game"}
          </div>
          
          <div class="game-board-container">
            <div class="board-and-scores">
              <div class="score-right-stacked comparison-scores">
                <button class="nav-btn nav-btn-large" id="prev-game-btn" aria-label="Previous game" ${currentGameIndex >= allGames.length - 1 ? "disabled" : ""}>
                  \u2039
                </button>
                <div class="score-metrics">
                  <div class="score-item" title="${hasReaderAverage ? `Per-puzzle NYT reader average${currentGame.nytReaderMode ? ` (${currentGame.nytReaderMode} mode)` : ""}` : "NYT reader data is loading or not yet published for this puzzle."}">
                    <span class="score-label">NYT Avg</span>
                    <span class="score-value" data-testid="popup-reader-average">${hasReaderAverage ? readerAverage.toFixed(2) : "N/A"}</span>
                  </div>
                  <button class="score-item solver-solution-btn" id="solver-solution-btn"
                    title="${showSolverBoard ? "Return to your played guesses." : solverTitle} ${comparisonDescription}"
                    aria-label="${showSolverBoard ? "Show your game" : "Show local solver solution"}"
                    aria-description="${comparisonDescription}"
                    aria-controls="popup-game-board"
                    ${solver?.guesses?.length ? "" : "disabled"}>
                    <span class="score-label">${showSolverBoard ? "User" : "Solver"}</span>
                    <span class="score-value" data-comparison="${comparison}">${showSolverBoard ? userTurnCount : solverTurns}</span>
                  </button>
                </div>
              </div>
              
              <div class="game-viewer-content">${gameBoard}</div>
              
              ${hasScores ? `
                <div class="score-right-stacked">
                  ${nextNav}
                  <div class="score-metrics" title="Your WordleBot luck and skill scores">
                    <div class="score-item">
                      <span class="score-label">Luck</span>
                      <span class="score-value">${currentGame.luckScore}</span>
                    </div>
                    <div class="score-item">
                      <span class="score-label">Skill</span>
                      <span class="score-value">${currentGame.skillScore}</span>
                    </div>
                  </div>
                </div>
              ` : `
                ${nextNav}
              `}
            </div>
          </div>
        </div>
      </div>
    `;
    }
    function renderGameBoard(game, label) {
      let pattern = [];
      if (game.guessPattern) {
        pattern = game.guessPattern;
      } else if (Array.isArray(game.guesses)) {
        pattern = game.guesses.map((row) => {
          if (typeof row === "string") {
            return Array.from(row).map((letter) => ({ letter, status: "absent" }));
          }
          return row.map((cell) => {
            if (typeof cell === "string") {
              return { letter: cell, status: "absent" };
            }
            return {
              letter: cell.letter || cell.value || "",
              status: normalizeGuessStatus(cell.status || cell.state || cell.result)
            };
          });
        });
      }
      const fullPattern = [];
      for (let i = 0; i < 6; i++) {
        if (i < pattern.length && pattern[i]) {
          fullPattern.push(pattern[i]);
        } else {
          fullPattern.push(Array(5).fill({ letter: "", status: "empty" }));
        }
      }
      return `
      <div class="game-board" id="popup-game-board" role="group" aria-label="${label}">
        ${fullPattern.map((row, rowIndex) => `
          <div class="board-row">
            ${row.map((cell, cellIndex) => `
              <div class="board-cell board-cell-${cell.status}">
                ${(cell.letter || "").toUpperCase()}
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>
    `;
    }
    function normalizeGuessStatus(rawStatus) {
      if (!rawStatus)
        return "absent";
      const lower = rawStatus.toLowerCase();
      if (lower.includes("incorrect") || lower.includes("absent"))
        return "absent";
      if (lower.includes("correct") || lower.includes("right") || lower.includes("exact")) {
        return "correct";
      }
      if (lower.includes("present") || lower.includes("misplaced") || lower.includes("close")) {
        return "present";
      }
      if (rawStatus === "\u{1F7E9}" || rawStatus === "\u{1F7E2}" || rawStatus === "\u2705") {
        return "correct";
      }
      if (rawStatus === "\u{1F7E8}" || rawStatus === "\u{1F7E1}") {
        return "present";
      }
      return "absent";
    }
    async function saveCurrentGameIndex() {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.CURRENT_GAME_INDEX]: currentGameIndex,
          [STORAGE_KEYS.LAST_GAMES_COUNT]: allGames.length
        });
      } catch (error) {
        console.warn("[Popup] Failed to save current game index:", error);
      }
    }
    async function loadCurrentGameIndex() {
      try {
        const result = await chrome.storage.local.get([
          STORAGE_KEYS.CURRENT_GAME_INDEX,
          STORAGE_KEYS.LAST_GAMES_COUNT
        ]);
        const savedIndex = result[STORAGE_KEYS.CURRENT_GAME_INDEX];
        const savedGamesCount = result[STORAGE_KEYS.LAST_GAMES_COUNT];
        if (typeof savedIndex === "number" && savedGamesCount === allGames.length && savedIndex >= 0 && savedIndex < allGames.length) {
          currentGameIndex = savedIndex;
          console.log("[Popup] Restored game index:", currentGameIndex);
        }
      } catch (error) {
        console.warn("[Popup] Failed to load current game index:", error);
      }
    }
    function renderLastGame() {
      if (!lastGame) {
        return "";
      }
      const date = new Date(lastGame.date);
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      const attempts = lastGame.attempts || lastGame.guesses || 0;
      const turnsClass = lastGame.won ? "won" : "lost";
      const turnsText = lastGame.won ? attempts.toString() : "Failed";
      const word = lastGame.solution || "\u2014";
      const hasWordleBotScores = lastGame.skillScore !== void 0 && lastGame.luckScore !== void 0;
      return `
      <div class="last-game-section">
        <div class="last-game-header">Last Game</div>
        <div class="last-game-details">
          <div class="last-game-row">
            <span class="last-game-label">Date</span>
            <span class="last-game-value">${formattedDate}</span>
          </div>
          <div class="last-game-row">
            <span class="last-game-label">Word</span>
            <span class="last-game-value">${word.toUpperCase()}</span>
          </div>
          <div class="last-game-row">
            <span class="last-game-label">Turns</span>
            <span class="last-game-value ${turnsClass}">${turnsText}</span>
          </div>
          ${hasWordleBotScores ? `
            <div class="last-game-scores">
              <div class="last-game-score">
                <div class="last-game-score-label">Skill</div>
                <div class="last-game-score-value">${lastGame.skillScore}</div>
              </div>
              <div class="last-game-score">
                <div class="last-game-score-label">Luck</div>
                <div class="last-game-score-value">${lastGame.luckScore}</div>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
    }
  });
})();
