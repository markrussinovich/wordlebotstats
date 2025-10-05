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
  
  // Render popup
  function render() {
    const timeFrames = ['7d', '30d', '90d', 'all'];
    
    container.innerHTML = `
      <div class="popup-container">
        <header class="popup-header">
          <h1>Wordle Stats</h1>
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
    if (isLoading) {
      return '<div class="loading">Loading stats...</div>';
    }
    
    if (!statistics) {
      return '<div class="no-data">No Wordle data found.</div>';
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
      
      if (response && response.success) {
        statistics = response.statistics;
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
  
  // Initial load
  loadStatistics();
});