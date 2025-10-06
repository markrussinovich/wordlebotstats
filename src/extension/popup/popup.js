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
  let scraperStatus = {
    active: false,
    message: ''
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
          <button class="dashboard-link" id="dashboard-btn" ${isLoading ? 'disabled' : ''}>
            Open Dashboard
          </button>
        </footer>
      </div>
    `;
    
    // Add event listeners
    attachEventListeners();
  }
  
  function renderContent() {
    if (scraperStatus.active) {
      return `
        <div class="stats-grid">
          <div class="loading">${scraperStatus.message}</div>
        </div>
      `;
    }
    
    if (isLoading) {
      return `
        <div class="stats-grid">
          <div class="loading">Loading stats...</div>
        </div>
      `;
    }
    
    if (!statistics) {
      return `
        <div class="stats-grid">
          <div class="no-data">No Wordle data found.</div>
        </div>
      `;
    }
    
    const streakLabel = selectedTimeFrame === '7d' ? 'Current Streak' : 'Longest Streak';
    const streakValue = selectedTimeFrame === '7d' ? statistics.currentStreak : statistics.maxStreak;
    
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${statistics.winRate.toFixed(1)}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${statistics.averageGuesses.toFixed(1)}</div>
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
        if (!dashboardBtn.disabled) {
          chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
          });
          window.close();
        }
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
  }
  
  async function loadStatistics() {
    try {
      isLoading = true;
      render();
      
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
        console.log('[Popup] ✅ Statistics loaded successfully:', statistics);
      } else {
        console.error('[Popup] Failed to load statistics:', response);
        statistics = null;
      }
    } catch (error) {
      console.error('[Popup] Error loading statistics:', error);
      statistics = null;
    } finally {
      isLoading = false;
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
        scraperStatus.message = `🔄 ${message.status}`;
      } else if (message.gamesFound > 0) {
        scraperStatus.message = `📥 Found ${message.gamesFound} games...`;
      } else {
        scraperStatus.message = '🔍 Starting...';
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
    }
  });
  
  // Auto-import on load
  async function triggerAutoImport() {
    try {
      console.log('[Popup] Triggering auto-import from WordleBot');
      
      scraperStatus.active = true;
      scraperStatus.message = '🔄 Checking for new games...';
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
      
      // Get the most recent game date from storage
      const result = await chrome.storage.local.get(['games']);
      const games = result.games || [];
      
      let stopAtDate = undefined;
      if (games.length > 0) {
        // Sort by date descending to get newest
        const sortedGames = games.sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateB.getTime() - dateA.getTime();
        });
        stopAtDate = sortedGames[0].date;
        console.log('[Popup] Will stop scraping at date:', stopAtDate);
      }
      
      scraperStatus.active = true;
      scraperStatus.message = '🔄 Checking for new games...';
      render();
      
      const response = await chrome.runtime.sendMessage({
        type: 'START_WORDLE_BOT_SCRAPE',
        mode: 'incremental',
        stopAtDate: stopAtDate,
        maxIterations: 20 // Shouldn't need many iterations for new games
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
});
