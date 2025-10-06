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
async function handleImportGameResult(message: ImportGameResultMessage): Promise<{ success: boolean }> {
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
    
    return { success: true };
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
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Total games in storage: ${games.length}`);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Timeframe requested: ${message.timeFrame}`);
    if (games.length > 0) {
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Sample game dates:`, games.slice(0, 5).map((g: any) => g.date));
    }
    
    // Calculate stats for the requested time frame
    const filteredGames = filterGamesByTimeFrame(games, message.timeFrame);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered games count: ${filteredGames.length}`);
    if (filteredGames.length > 0) {
      console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Filtered game dates:`, filteredGames.map((g: any) => g.date));
    }
    const statistics = calculateStatistics(filteredGames, games);
    console.log(`[BACKGROUND DEBUG] GET_QUICK_STATS: Calculated statistics:`, statistics);
    
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

async function handleStartWordleBotScrape(message: any): Promise<void | { success: boolean; skipped?: boolean; reason?: string; tabId?: number; message?: string }> {
  try {
    console.log(`[BACKGROUND DEBUG] Starting WordleBot scrape (mode: ${message.mode})`);
    console.log('[BACKGROUND DEBUG] Storage service available:', !!storageService);
    
    // Initialize storage service if not available
    if (!storageService) {
      console.log('[BACKGROUND DEBUG] Initializing storage service...');
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    
    // Get newest game date from storage for incremental mode
    let stopAtDate: string | undefined = message.stopAtDate;
    let newestStoredGame: any = null;
    if ((message.mode === 'incremental' || message.mode === 'auto') && !stopAtDate) {
      console.log('[BACKGROUND DEBUG] Getting newest game for incremental mode...');
      newestStoredGame = await storageService.getNewestGame();
      stopAtDate = newestStoredGame?.date;
      console.log('[BACKGROUND DEBUG] Newest stored game:', newestStoredGame?.date, 'Game#', newestStoredGame?.gameNumber);
    } else if (stopAtDate) {
      console.log('[BACKGROUND DEBUG] Using provided stopAtDate:', stopAtDate);
    }
    
    // Store scrape parameters in storage for content script to pick up
    console.log('[BACKGROUND DEBUG] Storing scrape parameters in storage...');
    await chrome.storage.local.set({
      wordleBotScrapeParams: {
        mode: message.mode,
        stopAtDate,
        maxIterations: message.maxIterations || 20,
        timestamp: Date.now()
      }
    });
    
    // Open WordleBot page in background tab
    console.log('[BACKGROUND DEBUG] Creating WordleBot tab...');
    const tab = await chrome.tabs.create({
      url: 'https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html',
      active: false
    });
    
    scraperTabId = tab.id || null;
    console.log('[BACKGROUND DEBUG] Opened WordleBot tab:', scraperTabId);
    
    // The content script will auto-start scraping when it loads
    console.log('[BACKGROUND DEBUG] Tab created, content script will auto-start scraping');
    
    return { success: true, ...(scraperTabId ? { tabId: scraperTabId } : {}), message: 'Scraping started' };
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

async function handleWordleBotScrapeProgress(message: any): Promise<{ success: boolean }> {
  console.log('[Background] Scrape progress:', message);
  
  // Forward progress to any listening popup/dashboard
  // This allows real-time progress updates in the UI
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might not be open, that's okay
  });
  
  return { success: true };
}

async function handleWordleBotScrapeComplete(message: any): Promise<{ success: boolean }> {
  console.log('[Background] Scrape complete:', message);
  
  // Update scraper metadata
  await storageService.updateScraperMetadata({
    lastScrape: new Date().toISOString(),
    lastScrapeMode: 'auto', // or get from message
    totalScraped: message.totalGames
  });
  
  // Close the scraper tab after a short delay
  if (scraperTabId) {
    setTimeout(() => {
      if (scraperTabId) {
        chrome.tabs.remove(scraperTabId).catch(() => {});
        scraperTabId = null;
      }
    }, 2000);
  }
  
  // Forward to popup/dashboard
  console.log('[Background] Forwarding COMPLETE message to popup');
  try {
    await chrome.runtime.sendMessage(message);
    console.log('[Background] COMPLETE message forwarded successfully');
  } catch (err) {
    console.log('[Background] Could not forward to popup:', err);
  }
  
  return { success: true };
}

async function handleWordleBotScrapeError(message: any): Promise<{ success: boolean }> {
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
  
  return { success: true };
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
  
  const now = new Date();
  const cutoffDate = new Date();
  
  switch (timeFrame) {
    case '7d':
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      cutoffDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      cutoffDate.setDate(now.getDate() - 90);
      break;
    default:
      return games;
  }
  
  console.log(`[BACKGROUND DEBUG] filterGamesByTimeFrame: Cutoff date for ${timeFrame}: ${cutoffDate.toISOString()}`);
  
  const filtered = games.filter((game: any) => {
    if (!game.date) return false;
    const gameDate = new Date(game.date);
    return gameDate >= cutoffDate;
  });
  
  console.log(`[BACKGROUND DEBUG] filterGamesByTimeFrame: Filtered ${filtered.length} games from ${games.length} total (cutoff: ${cutoffDate.toISOString()})`);
  return filtered;
}

function calculateStatistics(games: any[], allGames?: any[]): any {
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
  
  // Use all games for streak calculation if provided, otherwise use filtered games
  const gamesToUseForStreaks = allGames || games;
  const sortedAllGames = [...gamesToUseForStreaks].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Calculate current streak (count backwards from most recent)
  let currentStreak = 0;
  for (let i = sortedAllGames.length - 1; i >= 0; i--) {
    if (sortedAllGames[i].won) {
      currentStreak++;
    } else {
      break; // Stop at first loss
    }
  }
  
  // Calculate max streak (forward through all games)
  let maxStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < sortedAllGames.length; i++) {
    if (sortedAllGames[i].won) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  console.log(`[BACKGROUND DEBUG] calculateStatistics: Using ${gamesToUseForStreaks.length} games for streaks, ${games.length} games for other stats`);
  console.log(`[BACKGROUND DEBUG] calculateStatistics: currentStreak=${currentStreak}, maxStreak=${maxStreak}`);
  
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