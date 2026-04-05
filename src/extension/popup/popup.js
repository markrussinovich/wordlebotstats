// Popup script for Wordle Stats extension
console.log('[Popup] Popup script loading...');

// Simple popup implementation without React for now
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Popup] DOM loaded, initializing popup...');
  
  const container = document.getElementById('popup-root');
  if (!container) {
    console.error('[Popup] popup-root container not found');
    return;
  }
  
  // Initialize popup state
  let selectedTimeFrame = '7d';
  let isLoading = false;
  let statistics = null;
  let lastGame = null;
  let allGames = [];
  let currentGameIndex = 0;
  let scraperStatus = {
    active: false,
    message: ''
  };
  let activeNotification = null;
  
  // Storage keys for persistence
  const STORAGE_KEYS = {
    CURRENT_GAME_INDEX: 'popup_current_game_index',
    LAST_GAMES_COUNT: 'popup_last_games_count'
  };
  
  // Render popup
  function render() {
    const timeFrames = ['7d', '30d', '90d', 'all'];
    
    container.innerHTML = `
      <div class="popup-container">
        <header class="popup-header">
          <div class="popup-header-top">
            <h1>Wordle Stats</h1>
            <button class="refresh-btn" id="refresh-btn" ${scraperStatus.active ? 'disabled' : ''}>
              ↻ Refresh
            </button>
          </div>
        </header>
        
        <main class="popup-main">
          ${renderGameViewer()}
          
          <div class="time-frame-picker">
            ${timeFrames.map(tf => `
              <button 
                class="time-frame-btn ${selectedTimeFrame === tf ? 'active' : ''}"
                data-timeframe="${tf}"
              >
                ${tf.toUpperCase()}
              </button>
            `).join('')}
          </div>
          
          ${renderContent()}
        </main>
        
        <footer class="popup-footer">
          <button class="dashboard-link" id="dashboard-btn" ${(isLoading || scraperStatus.active) ? 'disabled' : ''}>
            Dashboard
          </button>
        </footer>
      </div>
    `;
    
    // Add event listeners
    attachEventListeners();
  }
  
  function renderContent() {
    const notifications = renderNotification();

    if (scraperStatus.active) {
      return `
        ${notifications}
        ${renderLoadingState(scraperStatus.message || 'Working...')}
      `;
    }

    if (isLoading) {
      return `
        ${notifications}
        ${renderLoadingState('Loading stats...')}
      `;
    }

    if (!statistics) {
      return `
        ${notifications}
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div class="empty-title">No Wordle data yet</div>
          <div class="empty-message">Play a game or import your history to see stats here.</div>
        </div>
      `;
    }

    const streakLabel = selectedTimeFrame === '7d' ? 'Current Streak' : 'Longest Streak';
    const streakValue = selectedTimeFrame === '7d' ? statistics.currentStreak : statistics.maxStreak;
    
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
    // Time frame buttons
    document.querySelectorAll('.time-frame-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedTimeFrame = e.target.dataset.timeframe;
        loadStatistics();
      });
    });
    
    // Dashboard button
    const dashboardBtn = document.getElementById('dashboard-btn');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => {
        if (dashboardBtn.disabled) {
          return;
        }

        dashboardBtn.disabled = true;

        chrome.runtime.sendMessage({
          type: 'OPEN_DASHBOARD_TAB'
        }).catch((err) => {
          console.error('[Popup] Failed to reuse dashboard tab, opening new one:', err);
          const fallbackUrl = chrome.runtime.getURL('dashboard.html');
          chrome.tabs.create({ url: fallbackUrl });
        }).finally(() => {
          window.close();
        });
      });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        if (!refreshBtn.disabled) {
          // Mark that we're doing a refresh - game index will be reset if new games found
          render();
          // Check for gaps on refresh; if found and not already filled today, do full scrape
          const didGapFill = await checkAndFillGaps();
          if (!didGapFill) {
            triggerIncrementalScrape();
          }
        }
      });
    }

    // Game navigation buttons
    const prevBtn = document.getElementById('prev-game-btn');
    const nextBtn = document.getElementById('next-game-btn');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        if (currentGameIndex < allGames.length - 1) {
          currentGameIndex++;
          await saveCurrentGameIndex();
          render();
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (currentGameIndex > 0) {
          currentGameIndex--;
          await saveCurrentGameIndex();
          render();
        }
      });
    }

    const dismissBtn = document.querySelector('[data-dismiss-notification]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        activeNotification = null;
        render();
      });
    }
  }
  
  async function loadStatistics() {
    try {
      // Don't show loading state for quick time frame switches
      // isLoading = true;
      // render();
      
      console.log('[Popup] Loading statistics for:', selectedTimeFrame);
      
      const [statsResponse, gamesResponse] = await Promise.all([
        chrome.runtime.sendMessage({
          type: 'GET_QUICK_STATS',
          timeFrame: selectedTimeFrame
        }),
        chrome.runtime.sendMessage({
          type: 'GET_DASHBOARD_DATA'
        })
      ]);
      
      console.log('[Popup] Statistics response:', statsResponse);
      console.log('[Popup] Games response:', gamesResponse);
      
      if (statsResponse && statsResponse.success) {
        statistics = statsResponse.statistics;
        lastGame = statsResponse.lastGame || null;
        console.log('[Popup] ✅ Statistics loaded successfully:', statistics);
        console.log('[Popup] ✅ Last game:', lastGame);
      } else {
        console.error('[Popup] Failed to load statistics:', statsResponse);
        statistics = null;
        lastGame = null;
      }
      
      if (gamesResponse && gamesResponse.success && gamesResponse.games) {
        const previousGamesCount = allGames.length;
        allGames = [...gamesResponse.games].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        // Only reset game index if this is the initial load or if we're not preserving state
        if (previousGamesCount === 0) {
          await loadCurrentGameIndex();
        }
        
        // Ensure current index is valid
        if (currentGameIndex >= allGames.length) {
          currentGameIndex = Math.max(0, allGames.length - 1);
        }
        
        console.log('[Popup] ✅ All games loaded:', allGames.length, 'Current index:', currentGameIndex);
      } else {
        console.error('[Popup] Failed to load games:', gamesResponse);
        allGames = [];
      }
    } catch (error) {
      console.error('[Popup] Error loading statistics:', error);
      statistics = null;
      lastGame = null;
    } finally {
      // Don't clear loading state here since we don't set it for quick switches
      // isLoading = false;
      render();
    }
  }
  
  // Listen for scraper progress messages
  chrome.runtime.onMessage.addListener(async (message) => {
    console.log('[Popup] Received message:', message);
    
    if (message.type === 'WORDLE_BOT_SCRAPE_PROGRESS') {
      scraperStatus.active = true;
      
      // Use custom status message if provided, otherwise generate one
      if (message.status && !message.status.match(/^(scanning|loading|processing)$/)) {
        // Custom message (like "Opening WordleBot page...")
        scraperStatus.message = message.status;
      } else if (message.gamesFound > 0) {
        scraperStatus.message = `Found ${message.gamesFound} games...`;
      } else {
        scraperStatus.message = 'Starting...';
      }
      render();
    } else if (message.type === 'WORDLE_BOT_SCRAPE_COMPLETE') {
      scraperStatus.active = false;
      scraperStatus.message = '';
      
      console.log(`[Popup] Scrape complete - ${message.newGames} new games, ${message.totalGames} total checked`);
      
      // Reset to most recent game if new games were found
      if (message.newGames > 0) {
        currentGameIndex = 0;
        await saveCurrentGameIndex();
        console.log('[Popup] Reset to newest game due to new games found');
      }
      
      // Always reload stats to show current data
      loadStatistics();
    } else if (message.type === 'WORDLE_BOT_SCRAPE_ERROR') {
      scraperStatus.active = false;
      scraperStatus.message = '';
      console.error('[Popup] Scrape error:', message.error);
      if (message.code === 'AUTH_REQUIRED') {
        activeNotification = {
          id: 'nyt-login-required',
          type: 'error',
          title: 'Sign in required',
          message: message.error || 'Please sign in to your NYTimes account and try again.',
          icon: '🔒'
        };
        render();
      } else if (message.error) {
        activeNotification = {
          id: 'scrape-error',
          type: 'error',
          title: 'Import failed',
          message: message.error,
          icon: '⚠️'
        };
        render();
      }
    }
  });
  
  // Auto-import on load
  async function triggerAutoImport(fillGaps = false) {
    try {
      console.log(`[Popup] Triggering auto-import from WordleBot (fillGaps: ${fillGaps})`);
      
      activeNotification = null;
      scraperStatus.active = true;
  scraperStatus.message = fillGaps ? 'Filling gaps in game history...' : 'Checking for new games...';
      render();
      
      const response = await chrome.runtime.sendMessage({
        type: 'START_WORDLE_BOT_SCRAPE',
        mode: fillGaps ? 'full' : 'auto',
        maxIterations: 50
      });
      
      console.log('[Popup] Auto-import response:', response);
      
      // If scraping was skipped or there's an error, clear the status
      if (response && (response.skipped || !response.success)) {
        scraperStatus.active = false;
        scraperStatus.message = '';
        render();
        console.log('[Popup] Scraping skipped or failed:', response.reason || 'unknown');
      }
      // Otherwise, the scraping is happening in the background and progress messages will update the UI
    } catch (error) {
      console.error('[Popup] Auto-import failed:', error);
      scraperStatus.active = false;
      scraperStatus.message = '';
      render();
    }
  }
  
  // Incremental scrape - fetch only new games
  async function triggerIncrementalScrape() {
    try {
      console.log('[Popup] Triggering incremental scrape for new games');
      
      activeNotification = null;
      scraperStatus.active = true;
  scraperStatus.message = 'Checking for new games...';
      render();
      
      // For incremental mode, don't pass stopAtDate - let the background script
      // handle duplicate detection. We just want to scrape the first page of games
      // (the most recent ones) and the background will skip duplicates automatically.
      const response = await chrome.runtime.sendMessage({
        type: 'START_WORDLE_BOT_SCRAPE',
        mode: 'incremental',
        maxIterations: 1 // Only scrape the first page (most recent games)
      });
      
      console.log('[Popup] Incremental scrape response:', response);
      
      if (response && !response.success) {
        scraperStatus.active = false;
        scraperStatus.message = '';
        render();
        console.log('[Popup] Scraping failed:', response.reason || 'unknown');
      }
    } catch (error) {
      console.error('[Popup] Incremental scrape failed:', error);
      scraperStatus.active = false;
      scraperStatus.message = '';
      render();
    }
  }
  
  // Detect gaps in game date history
  // Returns the largest gap in days between consecutive games, or 0 if no gaps
  function detectLargestGap(games) {
    if (games.length < 2) return { gapDays: 0 };
    
    // Sort dates ascending
    const dates = games
      .map(g => g.date)
      .filter(d => d) // skip any missing dates
      .sort();
    
    let largestGap = 0;
    let gapStart = null;
    let gapEnd = null;
    
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      
      if (diffDays > largestGap) {
        largestGap = diffDays;
        gapStart = dates[i - 1];
        gapEnd = dates[i];
      }
    }
    
    return { gapDays: largestGap, gapStart, gapEnd };
  }

  // Check for gaps and fill them (called on refresh button click)
  // Returns true if a gap-fill scrape was triggered, false otherwise
  async function checkAndFillGaps() {
    try {
      const result = await chrome.storage.local.get(['games', 'lastGapFillDate']);
      const games = result.games || [];
      
      if (games.length < 2) return false;
      
      // Only attempt gap-fill once per day
      const today = new Date().toISOString().slice(0, 10);
      if (result.lastGapFillDate === today) {
        console.log('[Popup] Gap-fill already attempted today, skipping');
        return false;
      }
      
      const { gapDays, gapStart, gapEnd } = detectLargestGap(games);
      console.log(`[Popup] Largest gap: ${gapDays} days (${gapStart} → ${gapEnd})`);
      
      if (gapDays >= 7) {
        console.log(`[Popup] Significant gap detected (${gapDays} days), triggering full scrape to fill`);
        // Remember we tried today so we don't re-trigger
        await chrome.storage.local.set({ lastGapFillDate: today });
        triggerAutoImport(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Popup] Error checking for gaps:', error);
      return false;
    }
  }

  // Check if auto-import is needed (only when no data at all)
  async function checkAndTriggerAutoImport() {
    try {
      const result = await chrome.storage.local.get(['games']);
      const games = result.games || [];
      
      console.log(`[Popup] Found ${games.length} games in storage`);
      
      if (games.length === 0) {
        console.log('[Popup] No games found, triggering auto-import');
        triggerAutoImport();
      }
    } catch (error) {
      console.error('[Popup] Error checking for auto-import:', error);
    }
  }
  
  // Initial load - loads immediately from storage
  loadStatistics();
  
  // Trigger auto-import only if needed (no data)
  checkAndTriggerAutoImport();

  function renderNotification() {
    if (!activeNotification) {
      return '';
    }

    const icon = activeNotification.icon || 'ℹ️';
    const title = activeNotification.title || 'Notice';
    const message = activeNotification.message || '';

    return `
      <div class="notification ${activeNotification.type}">
        <div class="notification-icon">${icon}</div>
        <div class="notification-body">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
        </div>
        <button class="notification-dismiss" data-dismiss-notification aria-label="Dismiss notification">✕</button>
      </div>
    `;
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

    // Parse date safely to avoid timezone shifts
    const dateParts = currentGame.date.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });

    const attempts = currentGame.attempts || currentGame.guesses || 0;
    const resultText = currentGame.won ? 'Won' : 'Lost';
    const resultClass = currentGame.won ? 'won' : 'lost';
    const word = currentGame.solution || '\u2014';
    const wordClass = currentGame.won ? '' : ' lost';

    // Create game board grid
    const gameBoard = renderGameBoard(currentGame);

    const hasScores = currentGame.skillScore !== undefined && currentGame.luckScore !== undefined;

    return `
      <div class="game-viewer">
        <div class="game-info">
          <div class="game-date">${formattedDate}</div>
        </div>
        
        <div class="game-viewer-content">
          <div class="game-word${wordClass}">${word.toUpperCase()}</div>
          
          <div class="game-board-container">
            <div class="board-and-scores">
              <button class="nav-btn nav-btn-large" id="prev-game-btn" ${currentGameIndex >= allGames.length - 1 ? 'disabled' : ''}>
                ‹
              </button>
              
              <div class="game-viewer-content">${gameBoard}</div>
              
              ${hasScores ? `
                <div class="score-right-stacked">
                  <button class="nav-btn nav-btn-large" id="next-game-btn" ${currentGameIndex <= 0 ? 'disabled' : ''}>
                    ›
                  </button>
                  <div style="margin-top: 16px;">
                    <div class="score-item">
                      <span class="score-label">Luck</span>
                      <span class="score-value">${currentGame.luckScore}</span>
                    </div>
                    <div class="score-item" style="margin-top: 8px;">
                      <span class="score-label">Skill</span>
                      <span class="score-value">${currentGame.skillScore}</span>
                    </div>
                  </div>
                </div>
              ` : `
                <button class="nav-btn nav-btn-large" id="next-game-btn" ${currentGameIndex <= 0 ? 'disabled' : ''}>
                  ›
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderGameBoard(game) {
    let pattern = [];
    
    // Try to use guessPattern first
    if (game.guessPattern) {
      pattern = game.guessPattern;
    } else if (game.guesses) {
      // Convert legacy guesses format
      pattern = game.guesses.map(row => {
        if (typeof row === 'string') {
          return Array.from(row).map(letter => ({ letter, status: 'absent' }));
        }
        return row.map(cell => {
          if (typeof cell === 'string') {
            return { letter: cell, status: 'absent' };
          }
          return {
            letter: cell.letter || cell.value || '',
            status: normalizeGuessStatus(cell.status || cell.state || cell.result)
          };
        });
      });
    }

    // Always ensure we have exactly 6 rows
    const fullPattern = [];
    for (let i = 0; i < 6; i++) {
      if (i < pattern.length && pattern[i]) {
        fullPattern.push(pattern[i]);
      } else {
        // Add empty row
        fullPattern.push(Array(5).fill({ letter: '', status: 'empty' }));
      }
    }

    return `
      <div class="game-board">
        ${fullPattern.map((row, rowIndex) => `
          <div class="board-row">
            ${row.map((cell, cellIndex) => `
              <div class="board-cell board-cell-${cell.status}">
                ${(cell.letter || '').toUpperCase()}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function normalizeGuessStatus(rawStatus) {
    if (!rawStatus) return 'absent';
    const lower = rawStatus.toLowerCase();
    if (lower.includes('correct') || lower.includes('right') || lower.includes('exact')) {
      return 'correct';
    }
    if (lower.includes('present') || lower.includes('misplaced') || lower.includes('close')) {
      return 'present';
    }
    if (rawStatus === '🟩' || rawStatus === '🟢' || rawStatus === '✅') {
      return 'correct';
    }
    if (rawStatus === '🟨' || rawStatus === '🟡') {
      return 'present';
    }
    return 'absent';
  }
  
  // Save current game index to storage
  async function saveCurrentGameIndex() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.CURRENT_GAME_INDEX]: currentGameIndex,
        [STORAGE_KEYS.LAST_GAMES_COUNT]: allGames.length
      });
    } catch (error) {
      console.warn('[Popup] Failed to save current game index:', error);
    }
  }
  
  // Load current game index from storage
  async function loadCurrentGameIndex() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.CURRENT_GAME_INDEX,
        STORAGE_KEYS.LAST_GAMES_COUNT
      ]);
      
      const savedIndex = result[STORAGE_KEYS.CURRENT_GAME_INDEX];
      const savedGamesCount = result[STORAGE_KEYS.LAST_GAMES_COUNT];
      
      // Only restore if we have the same number of games (no new games found)
      if (typeof savedIndex === 'number' && savedGamesCount === allGames.length && 
          savedIndex >= 0 && savedIndex < allGames.length) {
        currentGameIndex = savedIndex;
        console.log('[Popup] Restored game index:', currentGameIndex);
      }
    } catch (error) {
      console.warn('[Popup] Failed to load current game index:', error);
    }
  }

  function renderLastGame() {
    if (!lastGame) {
      return '';
    }

    const date = new Date(lastGame.date);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    const attempts = lastGame.attempts || lastGame.guesses || 0;
    const turnsClass = lastGame.won ? 'won' : 'lost';
    const turnsText = lastGame.won ? attempts.toString() : 'Failed';
    const word = lastGame.solution || '—';
    
    const hasWordleBotScores = lastGame.skillScore !== undefined && lastGame.luckScore !== undefined;
    
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
          ` : ''}
        </div>
      </div>
    `;
  }
});
