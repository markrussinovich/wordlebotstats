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

  // src/types/playTypes.ts
  var PLAY_SESSIONS_KEY = "wordlePlaySessions";
  var PLAY_SELECTION_KEY = "wordlePlaySelection";
  function localPuzzleDate(now = /* @__PURE__ */ new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  // src/utils/playHistory.ts
  var SHOW_UNPLAYED_KEY = "wordleShowUnplayed";
  function hasUserGame(game) {
    if (!game)
      return false;
    const guesses = game.guesses;
    return Boolean(
      game.won || game.completed || typeof game.attempts === "number" && game.attempts > 0 || typeof guesses === "number" && guesses > 0 || game.guessPattern?.some(
        (row) => row.some((cell) => Boolean(cell.letter?.trim()))
      ) || Array.isArray(guesses) && guesses.some(
        (row) => typeof row === "string" ? Boolean(row.trim()) : Array.isArray(row) && row.some(
          (cell) => typeof cell === "string" ? Boolean(cell.trim()) : Boolean(cell?.letter || cell?.value)
        )
      )
    );
  }
  function gamesWithPlaySessions(games, sessions, readers = {}) {
    const byDate = new Map(games.map((game) => [game.date, game]));
    for (const session of Object.values(sessions)) {
      if (hasUserGame(byDate.get(session.date)) || !session.rows.length || session.status === "playing" && session.canPlay !== false)
        continue;
      byDate.set(session.date, {
        ...byDate.get(session.date),
        date: session.date,
        attempts: session.rows.length,
        won: session.status === "won",
        completed: session.status !== "playing",
        hardMode: false,
        guessPattern: session.rows,
        solution: session.answer || (session.status === "won" ? session.rows[session.rows.length - 1]?.map((cell) => cell.letter).join("") : void 0),
        ...byDate.get(session.date)?.nytReaderSource === "manual" ? {} : readers[session.date],
        metadata: {
          ...byDate.get(session.date)?.metadata,
          extensionPlayMode: session.mode
        }
      });
    }
    return [...byDate.values()];
  }
  function buildGameHistory(games, showUnplayed, today = localPuzzleDate()) {
    const byDate = new Map(
      games.filter(
        (game) => /^\d{4}-\d{2}-\d{2}$/.test(game.date) && Number.isFinite(Date.parse(game.date)) && new Date(game.date).toISOString().slice(0, 10) === game.date && game.date >= "2021-06-19" && game.date <= today
      ).map((game) => [game.date, game])
    );
    if (showUnplayed) {
      const start = [...byDate.keys()].sort()[0] || today;
      const cursor = /* @__PURE__ */ new Date(`${start}T12:00:00Z`);
      while (cursor.toISOString().slice(0, 10) <= today) {
        const date = cursor.toISOString().slice(0, 10);
        if (!byDate.has(date))
          byDate.set(date, { date, attempts: 0, won: false, hardMode: false });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return [...byDate.values()].filter((game) => showUnplayed || hasUserGame(game)).sort((a, b) => b.date.localeCompare(a.date));
  }

  // src/play/guessReveal.ts
  var duration = 500;
  var stagger = 200;
  function shakeGuess(board, index) {
    const row = board?.children[index];
    if (!row || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    row.getAnimations().forEach((animation2) => {
      if (animation2.id === "wordle-invalid-guess")
        animation2.cancel();
    });
    const animation = row.animate(
      [0, -5, 5, -5, 5, -3, 3, -1, 1, 0].map((offset) => ({
        transform: `translateX(${offset}px)`
      })),
      { duration: 600, easing: "ease-in-out" }
    );
    animation.id = "wordle-invalid-guess";
  }
  function createGuessReveal() {
    let previous = null;
    const reveals = /* @__PURE__ */ new Map();
    const pops = /* @__PURE__ */ new Map();
    const clear = () => {
      reveals.forEach(
        (reveal) => reveal.animations.forEach((animation) => animation.cancel())
      );
      reveals.clear();
      pops.forEach((pop) => pop.animation?.cancel());
      pops.clear();
    };
    return (board) => {
      if (!board) {
        clear();
        previous = null;
        return;
      }
      const puzzle = `${board.dataset.date}:${board.getAttribute("aria-label")}`;
      const cells = Array.from(
        board.children,
        (row) => Array.from(row.children)
      );
      const rows = cells.map((row) => {
        const style = getComputedStyle(row[0]);
        return {
          letters: row.map((cell) => cell.textContent?.trim() || ""),
          draft: row.length === 5 && row.every((cell) => cell.dataset.state === "tbd"),
          scored: row.length === 5 && row.every(
            (cell) => ["correct", "present", "absent"].includes(cell.dataset.state || "")
          ),
          colors: {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            color: style.color
          }
        };
      });
      const now = performance.now();
      const ready = board.dataset.ready === "true";
      if (previous?.puzzle !== puzzle)
        clear();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        clear();
        previous = { puzzle, rows, ready };
        return;
      }
      if (previous?.puzzle === puzzle) {
        const oldRows = previous.rows;
        rows.forEach((row, index) => {
          const old = oldRows[index];
          if (ready && previous?.ready) {
            cells[index].forEach((cell, column) => {
              const letter = row.letters[column];
              if (cell.dataset.state === "tbd" && letter && !old?.letters[column])
                pops.set(index * 5 + column, { started: now, letter });
            });
          }
          if (old?.draft && row.scored && old.letters.every((letter, column) => letter === row.letters[column])) {
            reveals.set(index, {
              started: now,
              colors: old.colors,
              animations: []
            });
          }
        });
      }
      previous = { puzzle, rows, ready };
      pops.forEach((pop, index) => {
        const cell = cells[Math.floor(index / 5)]?.[index % 5];
        const elapsed = now - pop.started;
        if (!cell || cell.dataset.state !== "tbd" || cell.textContent?.trim() !== pop.letter || elapsed >= 100) {
          pop.animation?.cancel();
          pops.delete(index);
          return;
        }
        if (pop.animation?.effect instanceof KeyframeEffect && pop.animation.effect.target === cell)
          return;
        pop.animation?.cancel();
        const animation = cell.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.1)" },
            { transform: "scale(1)" }
          ],
          { duration: 100, easing: "ease-in-out" }
        );
        animation.id = "wordle-letter-pop";
        animation.currentTime = elapsed;
        pop.animation = animation;
      });
      reveals.forEach((reveal, index) => {
        const elapsed = now - reveal.started;
        if (elapsed >= duration + stagger * 4) {
          reveal.animations.forEach((animation) => animation.cancel());
          reveals.delete(index);
          return;
        }
        cells[index].forEach((cell, column) => {
          const old = reveal.animations[column];
          if (old?.effect instanceof KeyframeEffect && old.effect.target === cell)
            return;
          old?.cancel();
          const style = getComputedStyle(cell);
          const colors = {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            color: style.color
          };
          const animation = cell.animate(
            [
              { ...reveal.colors, transform: "rotateX(0deg)", offset: 0 },
              { ...reveal.colors, transform: "rotateX(90deg)", offset: 0.499 },
              { ...colors, transform: "rotateX(90deg)", offset: 0.5 },
              { ...colors, transform: "rotateX(0deg)", offset: 1 }
            ],
            {
              duration,
              delay: column * stagger,
              easing: "ease-in-out",
              fill: "backwards"
            }
          );
          animation.id = "wordle-guess-reveal";
          animation.currentTime = elapsed;
          reveal.animations[column] = animation;
        });
      });
    };
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
    let historyLoaded = false;
    let recordedGames = [];
    let playSessions = {};
    let playSession = null;
    let playBusy = false;
    const revealGuesses = createGuessReveal();
    let lastInvalidGuess = null;
    let showUnplayed = false;
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
    let playing = false;
    const params = new URLSearchParams(window.location.search);
    const popout = params.get("popout") === "1";
    const embedded = params.get("embedded") === "1";
    let initialDate = params.get("date");
    if (popout)
      document.documentElement.dataset.popout = "true";
    if (embedded)
      document.documentElement.dataset.embedded = "true";
    const historyReady = chrome.storage.local.get([SHOW_UNPLAYED_KEY, PLAY_SESSIONS_KEY, PLAY_SELECTION_KEY]).then((stored) => {
      showUnplayed = embedded || popout || stored[SHOW_UNPLAYED_KEY] === true;
      playSessions = stored[PLAY_SESSIONS_KEY] || {};
      if (popout)
        initialDate = stored[PLAY_SELECTION_KEY];
    }).catch(() => {
    });
    function rebuildHistory() {
      allGames = buildGameHistory(gamesWithPlaySessions(recordedGames, playSessions), showUnplayed);
      if (embedded)
        allGames = allGames.filter((game) => game.date === initialDate);
    }
    function changeUnplayed(value) {
      const date = allGames[currentGameIndex]?.date;
      showUnplayed = value;
      rebuildHistory();
      currentGameIndex = Math.max(0, allGames.findIndex((game) => game.date === date));
      if (allGames[currentGameIndex]?.date !== date) {
        playing = false;
        playSession = null;
      }
      render();
      saveCurrentGameIndex();
    }
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area !== "local")
        return;
      if (changes[SHOW_UNPLAYED_KEY] && !embedded)
        changeUnplayed(changes[SHOW_UNPLAYED_KEY].newValue === true);
      if (changes[PLAY_SESSIONS_KEY]) {
        const date = allGames[currentGameIndex]?.date;
        playSessions = changes[PLAY_SESSIONS_KEY].newValue || {};
        rebuildHistory();
        currentGameIndex = Math.max(0, allGames.findIndex((game) => game.date === date));
        render();
        if (hasUserGame(allGames[currentGameIndex])) {
          calculateSolverResults();
          calculateReaderAverages();
        }
      }
      if (changes.games)
        loadStatistics();
      if (popout && changes[PLAY_SELECTION_KEY]) {
        const index = allGames.findIndex((game) => game.date === changes[PLAY_SELECTION_KEY].newValue);
        if (index >= 0 && index !== currentGameIndex)
          showGame(index);
      }
    });
    window.addEventListener("message", (event) => {
      const frame = document.getElementById("popup-play-controls");
      if (event.origin !== window.location.origin || event.source !== frame?.contentWindow)
        return;
      if (event.data?.type === "WORDLE_PLAY_SIZE") {
        const height = event.data.height;
        if (embedded && Number.isFinite(height) && height > 0 && height <= 600)
          frame.parentElement.style.height = `${height}px`;
        return;
      }
      if (event.data?.type === "WORDLE_PLAY_NAV" && event.data.date === allGames[currentGameIndex]?.date && (event.data.key === "ArrowLeft" || event.data.key === "ArrowRight")) {
        navigateGame(event.data.key);
        return;
      }
      if (event.data?.type !== "WORDLE_PLAY_VIEW")
        return;
      if (event.data.session?.date !== allGames[currentGameIndex]?.date) {
        if (playing && frame?.dataset.date)
          frame.contentWindow.postMessage({ type: "WORDLE_PLAY_DATE", date: frame.dataset.date }, window.location.origin);
        return;
      }
      playSession = event.data.session;
      playBusy = event.data.busy === true;
      render();
      const invalid = event.data.invalidGuess;
      if (!playBusy && playing && invalid?.date === playSession.date && Number.isInteger(invalid.row) && invalid.row === playSession.rows.length && invalid.row < 6 && typeof invalid.token === "string" && invalid.token !== lastInvalidGuess) {
        lastInvalidGuess = invalid.token;
        shakeGuess(document.getElementById("popup-game-board"), invalid.row);
      }
      if (!playBusy && (!embedded || document.hasFocus()))
        document.getElementById("popup-game-board")?.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target;
      if (target.isContentEditable || target.closest?.('textarea, select, input:not([type="checkbox"]):not([type="radio"]), [role="textbox"]'))
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (!historyLoaded || !allGames.length || target.closest?.('input[type="radio"]'))
          return;
        event.preventDefault();
        navigateGame(event.key);
        return;
      }
      if (!playing)
        return;
      if (event.key === "Enter" && target.closest?.("button, a[href], input"))
        return;
      if (!(/^[a-z]$/i.test(event.key) || event.key === "Backspace" || event.key === "Enter"))
        return;
      const frame = document.getElementById("popup-play-controls");
      if (!frame?.contentWindow)
        return;
      event.preventDefault();
      frame.contentWindow.postMessage({
        type: "WORDLE_PLAY_KEY",
        date: allGames[currentGameIndex]?.date,
        key: event.key
      }, window.location.origin);
    });
    const attemptedReaders = /* @__PURE__ */ new Set();
    const solverCacheReady = chrome.storage.local.get(solverCacheKey).then((value) => {
      solverResults = value[solverCacheKey] || {};
    }).catch(() => {
    });
    let cacheWriteTimer = null;
    window.addEventListener("pagehide", () => {
      solverWorker?.terminate();
      flushSolverCache();
    });
    function flushSolverCache() {
      if (cacheWriteTimer === null)
        return;
      clearTimeout(cacheWriteTimer);
      cacheWriteTimer = null;
      const results = { ...solverResults };
      cacheWrites = cacheWrites.then(async () => {
        if (!chrome.runtime || "id" in chrome.runtime && !chrome.runtime.id)
          return;
        const stored = await chrome.storage.local.get(solverCacheKey);
        if (!chrome.runtime || "id" in chrome.runtime && !chrome.runtime.id)
          return;
        await chrome.storage.local.set({
          [solverCacheKey]: { ...stored[solverCacheKey], ...results }
        });
      }).catch((error) => {
        if (!/Extension context invalidated/i.test(error?.message || String(error)))
          console.warn("[Popup] Solver cache could not be saved:", error);
      });
    }
    function scheduleSolverCacheWrite() {
      if (!cacheWriteTimer)
        cacheWriteTimer = setTimeout(flushSolverCache, 2e3);
    }
    function needsReaderAverage(game) {
      const average = game.nytReaderAverage;
      if (!(Number.isFinite(average) && average >= 1 && average <= 7))
        return true;
      if (game.nytReaderMode !== (game.hardMode ? "hard" : "normal"))
        return true;
      const cutoff = /* @__PURE__ */ new Date();
      cutoff.setDate(cutoff.getDate() - 2);
      const recent = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
      return game.date >= recent;
    }
    async function calculateReaderAverages() {
      if (readerFetchRunning)
        return;
      readerFetchRunning = true;
      try {
        const current = allGames[currentGameIndex];
        for (const game of [current, ...allGames]) {
          if (!game?.solution || game.nytReaderSource === "manual" || !needsReaderAverage(game))
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
              recordedGames = recordedGames.map((item) => item.date === game.date ? response.game : item);
              allGames = allGames.map((item) => item.date === game.date ? response.game : item);
              render();
            }
          } catch (error) {
            console.warn("[Popup] Reader average unavailable:", error);
          }
        }
      } finally {
        readerFetchRunning = false;
        const current = allGames[currentGameIndex];
        if (current?.solution && current.nytReaderSource !== "manual" && needsReaderAverage(current) && !attemptedReaders.has(`${current.date}:${current.hardMode}`))
          calculateReaderAverages();
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
            scheduleSolverCacheWrite();
            render();
          }
          if (data.error)
            fail(data.error);
          else if (data.complete) {
            flushSolverCache();
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
    let renderedHtml = "";
    let renderedViewerHtml = "";
    function render() {
      playing = Boolean(historyLoaded && allGames[currentGameIndex] && !hasUserGame(allGames[currentGameIndex]));
      const timeFrames = ["7d", "30d", "90d", "all"];
      const frame = document.getElementById("popup-play-controls");
      if (playing && frame && frame.dataset.date !== allGames[currentGameIndex]?.date) {
        frame.dataset.date = allGames[currentGameIndex].date;
        playBusy = true;
        frame.contentWindow.postMessage({ type: "WORDLE_PLAY_DATE", date: frame.dataset.date }, window.location.origin);
      }
      const viewerHtml = renderGameViewer();
      if (playing && frame) {
        if (viewerHtml !== renderedViewerHtml) {
          const boardFocused = (!embedded || document.hasFocus()) && document.activeElement?.id === "popup-game-board";
          renderedViewerHtml = viewerHtml;
          container.querySelector(".game-viewer").outerHTML = viewerHtml;
          attachGameViewerListeners();
          if (boardFocused)
            document.getElementById("popup-game-board")?.focus({ preventScroll: true });
          revealGuesses(document.getElementById("popup-game-board"));
        }
        return;
      }
      const html = `
      <div class="popup-container">
        <header class="popup-header">
          <div class="popup-header-top">
            <h1>Wordle Companion</h1>
            <button class="refresh-btn" id="refresh-btn" ${scraperStatus.active ? "disabled" : ""}>
              \u21BB Refresh
            </button>
          </div>
        </header>
        
        <main class="popup-main">
          ${viewerHtml}
          
          ${playing ? "" : `<div class="time-frame-picker">
            ${timeFrames.map((tf) => `
              <button 
                class="time-frame-btn ${selectedTimeFrame === tf ? "active" : ""}"
                data-timeframe="${tf}"
              >
                ${tf.toUpperCase()}
              </button>
            `).join("")}
          </div>`}
          
          ${renderContent()}
        </main>
        
        <footer class="popup-footer">
          <button class="dashboard-link" id="dashboard-btn" ${isLoading || scraperStatus.active ? "disabled" : ""}>
            Dashboard
          </button>
        </footer>
      </div>
    `;
      if (html === renderedHtml && container.firstElementChild)
        return;
      renderedHtml = html;
      renderedViewerHtml = viewerHtml;
      container.innerHTML = html;
      attachEventListeners();
      revealGuesses(document.getElementById("popup-game-board"));
    }
    function renderContent() {
      if (playing) {
        const date = allGames[currentGameIndex].date;
        return `<div class="stats-play-region">
        <iframe id="popup-play-controls" data-date="${date}" title="Play Wordle"
          src="${chrome.runtime.getURL("play.html")}?compact=1&controls=1&date=${date}${popout ? "&popout=1" : ""}"></iframe>
      </div>`;
      }
      const notifications = renderNotification();
      const loadingMessage = scraperStatus.active ? scraperStatus.message || "Working..." : isLoading ? "Loading stats..." : "";
      if (loadingMessage && !statistics) {
        return `
        ${notifications}
        ${renderLoadingState(loadingMessage)}
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
      <div class="stats-region" aria-busy="${Boolean(loadingMessage)}">
      <div class="stats-grid" ${loadingMessage ? 'style="visibility: hidden" aria-hidden="true"' : ""}>
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
      ${loadingMessage ? renderLoadingState(loadingMessage) : ""}
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
            type: "OPEN_DASHBOARD_TAB",
            ...playing ? { page: "play" } : {}
          }).catch((err) => {
            console.error("[Popup] Failed to reuse dashboard tab, opening new one:", err);
            const fallbackUrl = chrome.runtime.getURL("dashboard.html") + (playing ? "#/play" : "");
            chrome.tabs.create({ url: fallbackUrl });
          }).finally(() => {
            if (popout)
              dashboardBtn.disabled = false;
            else
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
      attachGameViewerListeners();
      const dismissBtn = document.querySelector("[data-dismiss-notification]");
      if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
          activeNotification = null;
          render();
        });
      }
    }
    function attachGameViewerListeners() {
      const board = document.getElementById("popup-game-board");
      if (playing && board) {
        board.addEventListener("click", () => board.focus({ preventScroll: true }));
      }
      document.getElementById("show-unplayed")?.addEventListener("change", (event) => {
        changeUnplayed(event.target.checked);
        chrome.storage.local.set({ [SHOW_UNPLAYED_KEY]: showUnplayed });
      });
      const prevBtn = document.getElementById("prev-game-btn");
      const nextBtn = document.getElementById("next-game-btn");
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          if (currentGameIndex < allGames.length - 1)
            showGame(currentGameIndex + 1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (currentGameIndex > 0)
            showGame(currentGameIndex - 1);
        });
      }
      document.getElementById("latest-game-btn")?.addEventListener("click", () => showGame(0));
      document.getElementById("solver-solution-btn")?.addEventListener("click", () => {
        showSolverSolution = !showSolverSolution;
        render();
      });
    }
    function navigateGame(key) {
      const index = currentGameIndex + (key === "ArrowLeft" ? 1 : -1);
      if (historyLoaded && index >= 0 && index < allGames.length)
        showGame(index);
    }
    function showGame(index) {
      currentGameIndex = index;
      playing = playing && !hasUserGame(allGames[index]);
      playSession = null;
      showSolverSolution = false;
      render();
      saveCurrentGameIndex();
    }
    async function loadStatistics() {
      try {
        await historyReady;
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
          recordedGames = gamesResponse.games;
          rebuildHistory();
          if (!historyLoaded) {
            await loadCurrentGameIndex();
            const requestedIndex = allGames.findIndex((game) => game.date === initialDate);
            if (requestedIndex >= 0)
              currentGameIndex = requestedIndex;
          }
          historyLoaded = true;
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
      const toggle = `<label class="unplayed-toggle">
      <input id="show-unplayed" type="checkbox" aria-label="Show unplayed" ${showUnplayed ? "checked" : ""}>
      Show unplayed
    </label>`;
      if (!allGames || allGames.length === 0) {
        return `
        <div class="game-viewer">
          <div class="game-info">${toggle}</div>
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
      const unplayed = !hasUserGame(currentGame);
      const savedSession = playSessions[currentGame.date];
      const localSession = playSession?.date === currentGame.date && (!savedSession || savedSession.rows.length <= playSession.rows.length) ? playSession : savedSession;
      const word = unplayed ? "\u2014" : currentGame.solution || "\u2014";
      const hasScores = !unplayed && currentGame.skillScore !== void 0 && currentGame.luckScore !== void 0;
      const readerAverage = currentGame.nytReaderAverage;
      const hasReaderAverage = Number.isFinite(readerAverage) && readerAverage >= 1 && readerAverage <= 7;
      const solver = unplayed ? void 0 : solverResults[currentGame.solution?.trim().toUpperCase()];
      const solverTurns = solver?.status === "solved" ? solver.turns : solver?.status === "failed" ? "X/6" : unplayed || solver || solverError || !currentGame.solution ? "N/A" : "...";
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
      const wordClass = unplayed || (showSolverBoard ? solver.status === "solved" : currentGame.won) ? "" : " lost";
      const sessionBoard = localSession && !hasUserGame(recordedGames.find((game) => game.date === currentGame.date)) ? { guessPattern: [...localSession.rows, ...localSession.status === "playing" ? [Array.from({ length: 5 }, (_, column) => ({
        letter: localSession.draft[column] || "",
        status: localSession.draft[column] ? "tbd" : "empty"
      }))] : []] } : currentGame;
      const gameBoard = renderGameBoard(
        showSolverBoard ? { guessPattern: solver.guesses.map((guess) => guess.feedback) } : sessionBoard,
        showSolverBoard ? "Local solver board" : "Your game board",
        currentGame.date
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
      <div class="game-viewer" data-unplayed="${unplayed}">
        <div class="game-info">
          <div class="game-date">${formattedDate}</div>
          ${toggle}
        </div>
        
        <div class="game-viewer-content">
          <div class="game-word${wordClass}">${word.toUpperCase()}</div>
          <div class="game-board-mode" data-mode="${showSolverBoard ? "solver" : "user"}"
            title="${showSolverBoard ? solverTitle : "Your played guesses"}">
            ${showSolverBoard ? "Local solver (normal mode)" : unplayed && !localSession?.rows.length ? "Unplayed" : "Your game"}
          </div>
          
          <div class="game-board-container">
            <div class="board-and-scores">
              <div class="score-right-stacked comparison-scores">
                <button class="nav-btn nav-btn-large" id="prev-game-btn" aria-label="Previous game" ${currentGameIndex >= allGames.length - 1 ? "disabled" : ""}>
                  \u2039
                </button>
                ${unplayed ? "" : `<div class="score-metrics">
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
                </div>`}
              </div>
              
              <div class="game-viewer-content">${gameBoard}</div>
              
              <div class="score-right-stacked">
                ${nextNav}
                ${hasScores ? `
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
                ` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }
    function renderGameBoard(game, label, date) {
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
      <div class="game-board" id="popup-game-board" role="group" aria-label="${label}"
        data-date="${escapeHtml(date)}"
        ${playing ? `tabindex="0" aria-busy="${playBusy}" data-ready="${playSession?.date === date && !playBusy}"` : ""}>
        ${fullPattern.map((row, rowIndex) => `
          <div class="board-row">
            ${row.map((cell, cellIndex) => `
              <div class="board-cell board-cell-${cell.status}" data-state="${cell.status}">
                ${escapeHtml((cell.letter || "").toUpperCase())}
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
