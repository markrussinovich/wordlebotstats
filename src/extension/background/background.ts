// Background service worker for the Wordle Stats extension
// Handles extension lifecycle, message routing, and storage operations

import { 
  ImportGameResultMessage, 
  GetQuickStatsMessage,
  GetDashboardDataMessage,
  QuickStatsResponse,
  DashboardDataResponse,
  MessageType 
} from '@/types/messagingTypes';
import { GameResult } from '@/types/gameTypes';
import { ExtensionStorage } from './extensionStorage';

// Initialize storage service
let storageService: ExtensionStorage;

// Extension installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);
  
  try {
    // Initialize storage service
    storageService = ExtensionStorage.getInstance();
    await storageService.initialize();
    
    if (details.reason === 'install') {
      // Initialize default settings
      await initializeExtension();
    } else if (details.reason === 'update') {
      // Handle version updates
      await handleExtensionUpdate(details.previousVersion);
    }
  } catch (error) {
    console.error('[Background] Extension initialization failed:', error);
  }
});

// Message routing between extension components
chrome.runtime.onMessage.addListener(
  (message: any, sender, sendResponse) => {
    console.log('[BACKGROUND DEBUG] Received message:', message.type, message);
    console.log('[BACKGROUND DEBUG] Sender:', sender);
    
    handleExtensionMessage(message, sender)
      .then(response => {
        console.log('[BACKGROUND DEBUG] Sending response:', response);
        if (response) {
          sendResponse(response);
        }
      })
      .catch(error => {
        console.error('[BACKGROUND DEBUG] Message handling error:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
);

// Initialize extension with default settings
async function initializeExtension(): Promise<void> {
  try {
    // Set default preferences
    await chrome.storage.sync.set({
      preferences: {
        theme: 'system',
        defaultTimeFrame: '30d',
        showBenchmarks: true,
        enableNotifications: false,
        autoImport: true
      },
      lastSyncTime: Date.now(),
      version: chrome.runtime.getManifest().version
    });
    
    console.log('[Background] Extension initialized with default settings');
  } catch (error) {
    console.error('[Background] Failed to initialize extension:', error);
  }
}

// Handle extension updates
async function handleExtensionUpdate(previousVersion?: string): Promise<void> {
  try {
    console.log(`[Background] Updating from version ${previousVersion}`);
    
    // Perform any migration tasks based on version
    if (previousVersion && compareVersions(previousVersion, '1.0.0') < 0) {
      // Migration logic for versions before 1.0.0
      await migrateToV1();
    }
    
    // Update version in storage
    await chrome.storage.sync.set({
      version: chrome.runtime.getManifest().version,
      lastUpdateTime: Date.now()
    });
    
  } catch (error) {
    console.error('[Background] Failed to handle extension update:', error);
  }
}

// Route messages to appropriate handlers
async function handleExtensionMessage(
  message: any, 
  _sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case MessageType.IMPORT_GAME_RESULT:
      return handleImportGameResult(message as ImportGameResultMessage);
      
    case MessageType.GET_QUICK_STATS:
      return handleGetQuickStats(message as GetQuickStatsMessage);
      
    case MessageType.GET_DASHBOARD_DATA:
      return handleGetDashboardData(message as GetDashboardDataMessage);
      
    case MessageType.SYNC_DATA:
      return handleSyncData();
      
    case MessageType.EXPORT_DATA:
      return handleExportData();
      
    case MessageType.CLEAR_DATA:
      return handleClearData();
      
    case MessageType.START_WORDLE_BOT_SCRAPE:
      return handleStartWordleBotScrape(message);
      
    case 'BULK_IMPORT_GAMES':
      return handleBulkImportGames(message.games);
      
    case MessageType.WORDLE_BOT_SCRAPE_PROGRESS:
      return handleWordleBotScrapeProgress(message);
      
    case MessageType.WORDLE_BOT_SCRAPE_COMPLETE:
      return handleWordleBotScrapeComplete(message);
      
    case MessageType.WORDLE_BOT_SCRAPE_ERROR:
      return handleWordleBotScrapeError(message);
      
    default:
      throw new Error(`Unknown message type: ${(message as any).type}`);
  }
}

// Handle game result import from content script
async function handleImportGameResult(message: ImportGameResultMessage): Promise<void> {
  try {
    console.log('[Background] Importing game result:', message.gameResult);
    
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }

    // Save game using storage service
    await storageService.saveGame(message.gameResult);
    console.log('[Background] Game result saved successfully');
    
    // Get updated games for badge update
    const games = await storageService.getAllGames();
    await updateExtensionBadge(games);
    
  } catch (error) {
    console.error('[Background] Failed to import game result:', error);
    throw error;
  }
}

// Handle quick stats request for popup
async function handleGetQuickStats(message: GetQuickStatsMessage): Promise<QuickStatsResponse> {
  try {
    const result = await chrome.storage.local.get(['games']);
    const games = result.games || [];
    
    // Calculate stats for the requested time frame
    const filteredGames = filterGamesByTimeFrame(games, message.timeFrame);
    const statistics = calculateStatistics(filteredGames);
    
    return {
      success: true,
      statistics: {
        ...statistics,
        gameCount: filteredGames.length
      },
      timeFrame: message.timeFrame
    };
  } catch (error) {
    console.error('[Background] Failed to get quick stats:', error);
    throw error;
  }
}

// Handle dashboard data request
async function handleGetDashboardData(message: GetDashboardDataMessage): Promise<DashboardDataResponse> {
  try {
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }

    const [games, preferences] = await Promise.all([
      storageService.getAllGames(),
      storageService.getPreferences()
    ]);
    
    // Get benchmarks from extension storage (they're smaller)
    const benchmarksResult = await chrome.storage.local.get(['benchmarks']);
    
    return {
      success: true,
      games,
      benchmarks: benchmarksResult.benchmarks || [],
      preferences: preferences || {} as any,
      timeFrames: message.timeFrames || ['7d', '30d', '90d', 'all']
    };
  } catch (error) {
    console.error('[Background] Failed to get dashboard data:', error);
    throw error;
  }
}

// Handle data synchronization
async function handleSyncData(): Promise<void> {
  try {
    console.log('[Background] Synchronizing data...');
    
    // Sync local data to cloud storage if enabled
    const { preferences } = await chrome.storage.sync.get(['preferences']);
    
    if (preferences?.cloudSync) {
      // Implement cloud sync logic here
      console.log('[Background] Cloud sync is enabled, syncing data...');
    }
    
    await chrome.storage.sync.set({
      lastSyncTime: Date.now()
    });
  } catch (error) {
    console.error('[Background] Failed to sync data:', error);
    throw error;
  }
}

// Handle data export
async function handleExportData(): Promise<{ data: string; filename: string }> {
  try {
    const result = await chrome.storage.local.get(['games']);
    const games = result.games || [];
    
    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportDate: new Date().toISOString(),
      games
    };
    
    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `wordle-stats-${new Date().toISOString().split('T')[0]}.json`
    };
  } catch (error) {
    console.error('[Background] Failed to export data:', error);
    throw error;
  }
}

// Handle data clearing
async function handleClearData(): Promise<void> {
  try {
    await chrome.storage.local.clear();
    await chrome.storage.sync.remove(['lastSyncTime', 'lastImportTime']);
    
    // Reset badge
    chrome.action.setBadgeText({ text: '' });
    
    console.log('[Background] All data cleared');
  } catch (error) {
    console.error('[Background] Failed to clear data:', error);
    throw error;
  }
}

// WordleBot scraper handlers
let scraperTabId: number | null = null;

async function handleStartWordleBotScrape(message: any): Promise<void> {
  try {
    console.log(`[BACKGROUND DEBUG] Starting WordleBot scrape (mode: ${message.mode})`);
    console.log('[BACKGROUND DEBUG] Storage service available:', !!storageService);
    
    // Initialize storage service if not available
    if (!storageService) {
      console.log('[BACKGROUND DEBUG] Initializing storage service...');
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    
    // Check cooldown period (4 hours for auto mode)
    if (message.mode === 'auto') {
      console.log('[BACKGROUND DEBUG] Checking cooldown for auto mode...');
      const metadata = await storageService.getScraperMetadata();
      console.log('[BACKGROUND DEBUG] Scraper metadata:', metadata);
      if (metadata.lastScrape) {
        const lastScrapeTime = new Date(metadata.lastScrape).getTime();
        const now = Date.now();
        const hoursSince = (now - lastScrapeTime) / (1000 * 60 * 60);
        console.log('[BACKGROUND DEBUG] Hours since last scrape:', hoursSince);
        
        if (hoursSince < 4) {
          console.log('[BACKGROUND DEBUG] Skipping auto-scrape (cooldown period)');
          return; // Skip during cooldown
        }
      }
    }
    
    // Get newest game date from storage for incremental mode
    let stopAtDate: string | undefined;
    let newestStoredGame: any = null;
    if (message.mode === 'incremental' || message.mode === 'auto') {
      console.log('[BACKGROUND DEBUG] Getting newest game for incremental mode...');
      newestStoredGame = await storageService.getNewestGame();
      stopAtDate = newestStoredGame?.date;
      console.log('[BACKGROUND DEBUG] Newest stored game:', newestStoredGame?.date, 'Game#', newestStoredGame?.gameNumber);
    }
    
    // Open WordleBot page in background tab
    console.log('[BACKGROUND DEBUG] Creating WordleBot tab...');
    const tab = await chrome.tabs.create({
      url: 'https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html',
      active: false // Background tab
    });
    
    scraperTabId = tab.id || null;
    console.log('[BACKGROUND DEBUG] Opened WordleBot tab:', scraperTabId, tab);
    
    // Wait for tab to load
    console.log('[BACKGROUND DEBUG] Waiting 3 seconds for tab to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if there are newer games on the page before scraping
    if (tab.id && (message.mode === 'incremental' || message.mode === 'auto')) {
      console.log('[BACKGROUND DEBUG] Checking for newer games on page...');
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_NEWEST_PAGE_GAME' });
        console.log('[BACKGROUND DEBUG] Newest page game response:', response);
        
        if (response.success && response.game) {
          const newestPageGame = response.game;
          console.log('[BACKGROUND DEBUG] Newest page game:', newestPageGame.date, 'Game#', newestPageGame.gameNumber);
          
          // Compare with storage
          if (newestStoredGame) {
            const pageDate = newestPageGame.date || '';
            const storedDate = newestStoredGame.date || '';
            const pageGameNum = newestPageGame.gameNumber || 0;
            const storedGameNum = newestStoredGame.gameNumber || 0;
            
            // Check if page has newer games
            const hasNewerGames = pageGameNum > storedGameNum || pageDate > storedDate;
            
            if (!hasNewerGames) {
              console.log('[BACKGROUND DEBUG] No newer games found on page, skipping scrape');
              // Close tab and return early
              if (scraperTabId) {
                chrome.tabs.remove(scraperTabId).catch(() => {});
                scraperTabId = null;
              }
              return;
            } else {
              console.log('[BACKGROUND DEBUG] Found newer games on page, proceeding with scrape');
            }
          }
        }
      } catch (error) {
        console.warn('[BACKGROUND DEBUG] Failed to check newest page game, proceeding anyway:', error);
        // Continue with scrape even if check fails
      }
    }
    
    // Send scrape command to content script
    if (tab.id) {
      console.log('[BACKGROUND DEBUG] Sending scrape command to content script...');
      const contentMessage = {
        type: MessageType.START_WORDLE_BOT_SCRAPE,
        mode: message.mode,
        stopAtDate,
        maxIterations: message.maxIterations || 20
      };
      console.log('[BACKGROUND DEBUG] Content script message:', contentMessage);
      
      try {
        await chrome.tabs.sendMessage(tab.id, contentMessage);
        console.log('[BACKGROUND DEBUG] Message sent to content script successfully');
      } catch (error) {
        console.error('[BACKGROUND DEBUG] Failed to send message to content script:', error);
        throw error;
      }
    } else {
      console.error('[BACKGROUND DEBUG] No tab ID available');
    }
    
  } catch (error) {
    console.error('[Background] Failed to start WordleBot scrape:', error);
    if (scraperTabId) {
      chrome.tabs.remove(scraperTabId).catch(() => {});
      scraperTabId = null;
    }
    throw error;
  }
}

async function handleBulkImportGames(games: GameResult[]): Promise<{ success: boolean; imported: number; duplicates: number; errors: number }> {
  try {
    console.log(`[Background] Bulk importing ${games.length} games`);
    
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    
    const result = await storageService.bulkImportGames(games);
    console.log('[Background] Bulk import complete:', result);
    
    // Update badge
    const allGames = await storageService.getAllGames();
    await updateExtensionBadge(allGames);
    
    return { success: true, ...result };
  } catch (error) {
    console.error('[Background] Failed to bulk import games:', error);
    return { success: false, imported: 0, duplicates: 0, errors: games.length };
  }
}

async function handleWordleBotScrapeProgress(message: any): Promise<void> {
  console.log('[Background] Scrape progress:', message);
  
  // Forward progress to any listening popup/dashboard
  // This allows real-time progress updates in the UI
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might not be open, that's okay
  });
}

async function handleWordleBotScrapeComplete(message: any): Promise<void> {
  console.log('[Background] Scrape complete:', message);
  
  // Update scraper metadata
  await storageService.updateScraperMetadata({
    lastScrape: new Date().toISOString(),
    lastScrapeMode: 'auto', // or get from message
    totalScraped: message.totalGames
  });
  
  // Close the scraper tab
  if (scraperTabId) {
    setTimeout(() => {
      if (scraperTabId) {
        chrome.tabs.remove(scraperTabId).catch(() => {});
        scraperTabId = null;
      }
    }, 2000); // Wait 2 seconds before closing
  }
  
  // Forward to popup/dashboard
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function handleWordleBotScrapeError(message: any): Promise<void> {
  console.error('[Background] Scrape error:', message);
  
  // Update scraper metadata
  await storageService.updateScraperMetadata({
    lastError: message.error
  });
  
  // Close the scraper tab
  if (scraperTabId) {
    chrome.tabs.remove(scraperTabId).catch(() => {});
    scraperTabId = null;
  }
  
  // Forward to popup/dashboard
  chrome.runtime.sendMessage(message).catch(() => {});
}

// Update extension badge with current streak
async function updateExtensionBadge(games: any[]): Promise<void> {
  try {
    const statistics = calculateStatistics(games);
    const streak = statistics.currentStreak;
    
    if (streak > 0) {
      chrome.action.setBadgeText({ 
        text: streak.toString() 
      });
      chrome.action.setBadgeBackgroundColor({ 
        color: '#22c55e' 
      });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('[Background] Failed to update badge:', error);
  }
}

// Utility functions
function filterGamesByTimeFrame(games: any[], timeFrame: string): any[] {
  if (timeFrame === 'all') return games;
  
  const days = timeFrame === '7d' ? 7 : timeFrame === '30d' ? 30 : 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return games.filter((game: any) => 
    new Date(game.date) >= cutoffDate
  );
}

function calculateStatistics(games: any[]): any {
  if (games.length === 0) {
    return {
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      gameCount: 0
    };
  }
  
  const wins = games.filter(game => game.won);
  const winRate = (wins.length / games.length) * 100;
  
  const totalGuesses = wins.reduce((sum, game) => sum + (game.attempts || 0), 0);
  const averageGuesses = wins.length > 0 ? totalGuesses / wins.length : 0;
  
  // Calculate streaks
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  
  // Sort games by date (most recent first)
  const sortedGames = [...games].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  for (const game of sortedGames) {
    if (game.won) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
      if (currentStreak === 0) {
        currentStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
      if (currentStreak > 0) {
        currentStreak = 0;
      }
    }
  }
  
  return {
    winRate,
    averageGuesses,
    currentStreak,
    maxStreak,
    gameCount: games.length
  };
}

function compareVersions(version1: string, version2: string): number {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part < v2part) return -1;
    if (v1part > v2part) return 1;
  }
  
  return 0;
}

async function migrateToV1(): Promise<void> {
  // Implement migration logic for version 1.0.0
  console.log('[Background] Migrating to version 1.0.0');
}