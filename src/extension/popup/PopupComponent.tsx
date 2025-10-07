import React, { useEffect, useState } from 'react';
import { TimeFrame } from '@/types/benchmarkTypes';
import { useGameDataStore } from '@/stores/gameData';
import { MessageType } from '@/types/messagingTypes';

interface PopupProps {}

interface ScraperStatus {
  checking: boolean;
  importing: boolean;
  gamesFound: number;
  newGames: number;
  error: string | null;
}

const Popup: React.FC<PopupProps> = () => {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('7d');
  const [error, setError] = useState<string | null>(null);
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus>({
    checking: false,
    importing: false,
    gamesFound: 0,
    newGames: 0,
    error: null
  });
  const { 
    sendStatsRequest, 
    getStatisticsForTimeFrame, 
    isLoading,
    loadDataFromExtension 
  } = useGameDataStore();

  const statistics = getStatisticsForTimeFrame(selectedTimeFrame);

  // Debug logging for console
  console.log('[POPUP DEBUG] Component state:', {
    selectedTimeFrame,
    error,
    scraperStatus,
    isLoading,
    statistics,
    timestamp: new Date().toISOString()
  });

  // Load statistics using store method
  const loadStatistics = async (timeFrame: TimeFrame) => {
    try {
      setError(null);
      await sendStatsRequest(timeFrame);
    } catch (err) {
      console.error('[Popup] Failed to load statistics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Auto-import from WordleBot
  const triggerAutoImport = async () => {
    try {
      console.log('[POPUP DEBUG] triggerAutoImport called');
      setScraperStatus(prev => {
        console.log('[POPUP DEBUG] Setting scraper status to checking=true, prev:', prev);
        return { ...prev, checking: true };
      });
      console.log('[POPUP DEBUG] Triggering auto-import from WordleBot');
      
      // Send message to background to start scraping
      console.log('[POPUP DEBUG] Sending message to background script');
      const response = await chrome.runtime.sendMessage({
        type: MessageType.START_WORDLE_BOT_SCRAPE,
        mode: 'auto',
        maxIterations: 10 // Limit for popup auto-import
      });
      console.log('[POPUP DEBUG] Background script response:', response);
      
      // Set timeout in case scraper doesn't respond
      setTimeout(() => {
        setScraperStatus(prev => {
          if (prev.checking || prev.importing) {
            console.warn('[Popup] Auto-import timed out, loading stats anyway');
            return {
              checking: false,
              importing: false,
              gamesFound: 0,
              newGames: 0,
              error: null
            };
          }
          return prev;
        });
      }, 10000); // 10 second timeout
      
    } catch (err) {
      console.error('[POPUP DEBUG] Failed to trigger auto-import:', err);
      setScraperStatus(prev => ({
        ...prev,
        checking: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }));
    }
  };

  // Listen for scraper messages
  useEffect(() => {
    const messageListener = (message: any) => {
      console.log('[POPUP DEBUG] Received message:', message);
      switch (message.type) {
        case MessageType.WORDLE_BOT_SCRAPE_PROGRESS:
          console.log('[POPUP DEBUG] Progress message received:', message);
          setScraperStatus(prev => ({
            ...prev,
            checking: false,
            importing: true,
            gamesFound: message.gamesFound
          }));
          break;
          
        case MessageType.WORDLE_BOT_SCRAPE_COMPLETE:
          console.log('[POPUP DEBUG] Scrape complete message received:', message);
          setScraperStatus(prev => ({
            ...prev,
            importing: false,
            newGames: message.newGames,
            error: null
          }));
          
          // Reload statistics
          console.log('[POPUP DEBUG] Reloading statistics after scrape complete');
          loadStatistics(selectedTimeFrame);
          
          // Clear status after 3 seconds
          setTimeout(() => {
            setScraperStatus({
              checking: false,
              importing: false,
              gamesFound: 0,
              newGames: 0,
              error: null
            });
          }, 3000);
          break;
          
        case MessageType.WORDLE_BOT_SCRAPE_ERROR:
          console.log('[POPUP DEBUG] Scrape error message received:', message);
          setScraperStatus(prev => ({
            ...prev,
            checking: false,
            importing: false,
            error: message.error
          }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [selectedTimeFrame]);

  useEffect(() => {
    console.log('[POPUP DEBUG] selectedTimeFrame changed:', selectedTimeFrame);
    loadStatistics(selectedTimeFrame);
  }, [selectedTimeFrame]);

  // Initialize data and trigger auto-import on mount
  useEffect(() => {
    console.log('[POPUP DEBUG] Component mounting, initializing...');
    console.log('[POPUP DEBUG] Chrome runtime available:', !!chrome?.runtime);
    console.log('[POPUP DEBUG] Chrome tabs available:', !!chrome?.tabs);
    
    loadDataFromExtension().then(() => {
      console.log('[POPUP DEBUG] loadDataFromExtension completed');
    }).catch(err => {
      console.error('[POPUP DEBUG] loadDataFromExtension failed:', err);
    });
    
    // Trigger auto-import after a short delay (non-blocking)
    setTimeout(() => {
      console.log('[POPUP DEBUG] Starting auto-import timeout');
      triggerAutoImport().catch(err => {
        console.error('[POPUP DEBUG] Auto-import failed:', err);
        // Continue anyway - don't block popup
      });
    }, 500);
    
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTimeFrameChange = (timeFrame: TimeFrame) => {
    setSelectedTimeFrame(timeFrame);
  };

  const openDashboard = () => {
    if (!chrome?.tabs) {
      return;
    }

    const dashboardUrl = chrome.runtime.getURL('dashboard.html');
  chrome.tabs.query({ url: [`${dashboardUrl}*`] }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] Error querying dashboard tabs:', chrome.runtime.lastError);
        chrome.tabs.create({ url: dashboardUrl });
        window.close();
        return;
      }

      if (tabs && tabs.length > 0) {
        const existingTab = tabs[0];
        if (existingTab.id !== undefined) {
          chrome.tabs.reload(existingTab.id);
          chrome.tabs.update(existingTab.id, { active: true });
        }
        if (existingTab.windowId !== undefined) {
          chrome.windows?.update(existingTab.windowId, { focused: true });
        }
        window.close();
      } else {
        chrome.tabs.create({ url: dashboardUrl });
        window.close();
      }
    });
  };

  return (
    <div className="popup-container">
      {/* Skip link for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <header className="popup-header">
        <h1 id="popup-title">Wordle Stats</h1>
        <div 
          className="time-frame-picker" 
          role="group" 
          aria-labelledby="time-frame-label"
        >
          <span id="time-frame-label" className="sr-only">
            Select time frame for statistics
          </span>
          {(['7d', '30d', '90d', 'all'] as TimeFrame[]).map((timeFrame) => (
            <button
              key={timeFrame}
              className={`time-frame-btn focus-visible ${selectedTimeFrame === timeFrame ? 'active' : ''}`}
              onClick={() => handleTimeFrameChange(timeFrame)}
              aria-pressed={selectedTimeFrame === timeFrame}
              aria-label={`Show statistics for ${
                timeFrame === '7d' ? 'last 7 days' :
                timeFrame === '30d' ? 'last 30 days' :
                timeFrame === '90d' ? 'last 90 days' :
                'all time'
              }`}
            >
              {timeFrame.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main id="main-content" className="popup-main" role="main">
        {scraperStatus.checking ? (
          <div className="loading" role="status" aria-live="polite">
            <span className="sr-only">Checking for latest games...</span>
            <span aria-hidden="true">🔄 Checking for latest games...</span>
          </div>
        ) : scraperStatus.importing ? (
          <div className="loading" role="status" aria-live="polite">
            <span className="sr-only">Importing games...</span>
            <span aria-hidden="true">📥 Importing {scraperStatus.gamesFound} games...</span>
          </div>
        ) : scraperStatus.newGames > 0 ? (
          <div className="success" role="status" aria-live="polite" style={{ textAlign: 'center', padding: '20px', color: '#6aaa64' }}>
            <span>✓ Added {scraperStatus.newGames} new game{scraperStatus.newGames > 1 ? 's' : ''}!</span>
          </div>
        ) : scraperStatus.error ? (
          <div className="error" role="alert">
            <p>Import error: {scraperStatus.error}</p>
            <button 
              className="retry-button focus-visible"
              onClick={triggerAutoImport}
              aria-describedby="error-help"
            >
              Retry Import
            </button>
          </div>
        ) : error ? (
          <div className="error" role="alert">
            <p>Error: {error}</p>
            <button 
              className="retry-button focus-visible"
              onClick={() => loadStatistics(selectedTimeFrame)}
              aria-describedby="error-help"
            >
              Retry Loading Stats
            </button>
            <span id="error-help" className="sr-only">
              Click to retry loading your Wordle statistics
            </span>
          </div>
        ) : isLoading ? (
          <div className="loading" role="status" aria-live="polite">
            <span className="sr-only">Loading statistics...</span>
            <span aria-hidden="true">Loading stats...</span>
          </div>
        ) : statistics ? (
          <div className="stats-grid" role="group" aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="sr-only">
              Your Wordle Statistics for {selectedTimeFrame}
            </h2>
            
            <div className="stat-card" role="group" aria-labelledby="win-rate-label">
              <div id="win-rate-label" className="stat-label">Win Rate</div>
              <div className="stat-value" aria-describedby="win-rate-desc">
                {statistics.winRate.toFixed(1)}%
              </div>
              <span id="win-rate-desc" className="sr-only">
                Percentage of games won
              </span>
            </div>
            
            <div className="stat-card" role="group" aria-labelledby="avg-guesses-label">
              <div id="avg-guesses-label" className="stat-label">Avg Guesses</div>
              <div className="stat-value" aria-describedby="avg-guesses-desc">
                {statistics.averageGuesses.toFixed(1)}
              </div>
              <span id="avg-guesses-desc" className="sr-only">
                Average number of guesses to solve
              </span>
            </div>
            
            <div className="stat-card" role="group" aria-labelledby="streak-label">
              <div id="streak-label" className="stat-label">
                {selectedTimeFrame === '7d' ? 'Current Streak' : 'Longest Streak'}
              </div>
              <div className="stat-value" aria-describedby="streak-desc">
                {selectedTimeFrame === '7d' ? statistics.currentStreak : statistics.maxStreak}
              </div>
              <span id="streak-desc" className="sr-only">
                {selectedTimeFrame === '7d' ? 'Current winning streak' : 'Longest winning streak'}
              </span>
            </div>
            
            <div className="stat-card" role="group" aria-labelledby="games-label">
              <div id="games-label" className="stat-label">Games Played</div>
              <div className="stat-value" aria-describedby="games-desc">
                {statistics.gameCount}
              </div>
              <span id="games-desc" className="sr-only">
                Total number of games played
              </span>
            </div>
          </div>
        ) : (
          <div className="no-data" role="status">
            <p>No Wordle data found.</p>
            <p className="help-text">Visit nytimes.com/games/wordle to start tracking your games!</p>
          </div>
        )}
      </main>

      <footer className="popup-footer">
        <button 
          className="dashboard-link focus-visible"
          onClick={openDashboard}
          disabled={
            isLoading ||
            scraperStatus.checking ||
            scraperStatus.importing
          }
        >
          Open Dashboard
        </button>
      </footer>
    </div>
  );
};

export default Popup;