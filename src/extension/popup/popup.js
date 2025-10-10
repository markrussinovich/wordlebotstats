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
  let scraperStatus = {
    active: false,
    message: ''
  };
  let activeNotification = null;
  
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
        </header>
        
        <main class="popup-main">
          ${renderContent()}
        </main>
        
        <footer class="popup-footer">
          <button class="dashboard-link" id="dashboard-btn" ${(isLoading || scraperStatus.active) ? 'disabled' : ''}>
            Open Dashboard
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
      ${renderLastGame()}
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
      refreshBtn.addEventListener('click', () => {
        if (!refreshBtn.disabled) {
          triggerIncrementalScrape();
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
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_QUICK_STATS',
        timeFrame: selectedTimeFrame
      });
      
      console.log('[Popup] Statistics response:', response);
      console.log('[Popup] Game count for timeframe:', response?.statistics?.gameCount);
      console.log('[Popup] Win rate:', response?.statistics?.winRate);
      console.log('[Popup] Average guesses:', response?.statistics?.averageGuesses);
      
      if (response && response.success) {
        statistics = response.statistics;
        lastGame = response.lastGame || null;
        console.log('[Popup] ✅ Statistics loaded successfully:', statistics);
        console.log('[Popup] ✅ Last game:', lastGame);
      } else {
        console.error('[Popup] Failed to load statistics:', response);
        statistics = null;
        lastGame = null;
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
  chrome.runtime.onMessage.addListener((message) => {
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
  async function triggerAutoImport() {
    try {
      console.log('[Popup] Triggering auto-import from WordleBot');
      
      activeNotification = null;
      scraperStatus.active = true;
  scraperStatus.message = 'Checking for new games...';
      render();
      
      const response = await chrome.runtime.sendMessage({
        type: 'START_WORDLE_BOT_SCRAPE',
        mode: 'auto',
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
  
  // Check if auto-import is needed
  async function checkAndTriggerAutoImport() {
    try {
      // Check if we have any games in storage
      const result = await chrome.storage.local.get(['games']);
      const games = result.games || [];
      
      console.log(`[Popup] Found ${games.length} games in storage`);
      
      // Only auto-import if no games exist
      if (games.length === 0) {
        console.log('[Popup] No games found, triggering auto-import');
        triggerAutoImport();
      } else {
        console.log('[Popup] Games exist, skipping auto-import');
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
