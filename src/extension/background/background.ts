// Background service worker for the Wordle Stats extension
// Handles extension lifecycle, message routing, and storage operations

import { 
  ImportGameResultMessage, 
  GetQuickStatsMessage,
  GetDashboardDataMessage,
  QuickStatsResponse,
  DashboardDataResponse,
  MessageType,
  WordleBotScrapeStatusSnapshot,
  WordleBotScrapeStatusResponse,
  WordleBotScrapePhase,
  OpenDashboardTabMessage,
  OpenDashboardTabResponse
} from '@/types/messagingTypes';
import { GameResult } from '@/types/gameTypes';
import { ExtensionStorage } from './extensionStorage';
import logger from '../utils/logger';
const log = logger.log; const warn = logger.warn; const errorLog = logger.error;

// Initialize storage service
let storageService: ExtensionStorage;

const SCRAPE_STATUS_STORAGE_KEY = 'wordleBotScrapeStatus';

let dashboardTabId: number | null = null;

let currentScrapeStatus: WordleBotScrapeStatusSnapshot = {
  phase: 'idle',
  gamesFound: 0,
  gamesProcessed: 0,
  newGames: 0,
  duplicates: 0,
  errors: 0,
  lastUpdated: new Date().toISOString(),
  statusMessage: 'Idle',
  error: null
};

type ScrapeStatusUpdate = Partial<Omit<WordleBotScrapeStatusSnapshot, 'phase' | 'lastUpdated'>> & {
  phase?: WordleBotScrapePhase;
};

async function updateScrapeStatus(update: ScrapeStatusUpdate): Promise<void> {
  const nextPhase = update.phase ?? currentScrapeStatus.phase;
  currentScrapeStatus = {
    ...currentScrapeStatus,
    ...update,
    phase: nextPhase,
    lastUpdated: new Date().toISOString()
  };

  try {
    await chrome.storage.local.set({
      [SCRAPE_STATUS_STORAGE_KEY]: currentScrapeStatus
    });
  } catch (storageError) {
  errorLog('[Background] Failed to persist scrape status:', storageError);
  }

  log('[Background] =====> Sending WORDLE_BOT_SCRAPE_STATUS_UPDATED message:', currentScrapeStatus);
  chrome.runtime.sendMessage({
    type: MessageType.WORDLE_BOT_SCRAPE_STATUS_UPDATED,
    status: currentScrapeStatus
  }).then(() => {
  log('[Background] =====> STATUS_UPDATED message sent successfully');
  }).catch((err) => {
  log('[Background] =====> STATUS_UPDATED message failed:', err);
  });
}

async function loadInitialScrapeStatus(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([SCRAPE_STATUS_STORAGE_KEY]);
    if (result && result[SCRAPE_STATUS_STORAGE_KEY]) {
      currentScrapeStatus = {
        ...currentScrapeStatus,
        ...result[SCRAPE_STATUS_STORAGE_KEY]
      };
    } else {
      await chrome.storage.local.set({
        [SCRAPE_STATUS_STORAGE_KEY]: currentScrapeStatus
      });
    }
  } catch (error) {
  errorLog('[Background] Failed to hydrate scrape status from storage:', error);
  }
}

loadInitialScrapeStatus().catch(() => {
  // Best-effort hydration; ignore failures here.
});

// Extension installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
  log('[Background] Extension installed:', details.reason);
  
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
  errorLog('[Background] Extension initialization failed:', error);
  }
});

// Message routing between extension components
chrome.runtime.onMessage.addListener(
  (message: any, sender, sendResponse) => {
    handleExtensionMessage(message, sender)
      .then(response => {
        if (response) {
          sendResponse(response);
        }
      })
      .catch(error => {
        console.error('[Background] Message handling error:', error);
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
    case MessageType.OPEN_DASHBOARD_TAB:
      return handleOpenDashboardTab(message as OpenDashboardTabMessage);
      
    case MessageType.SYNC_DATA:
      return handleSyncData();
      
    case MessageType.EXPORT_DATA:
      return handleExportData();
      
    case MessageType.CLEAR_DATA:
      return handleClearData();
      
    case MessageType.START_WORDLE_BOT_SCRAPE:
      return handleStartWordleBotScrape(message);
      
    case 'BULK_IMPORT_GAMES':
      console.log(`[Background] =====> Received BULK_IMPORT_GAMES message`);
      return handleBulkImportGames(message.games);
      
    case MessageType.WORDLE_BOT_SCRAPE_PROGRESS:
      return handleWordleBotScrapeProgress(message);
      
    case MessageType.WORDLE_BOT_SCRAPE_COMPLETE:
      return handleWordleBotScrapeComplete(message);
      
    case MessageType.WORDLE_BOT_SCRAPE_ERROR:
      return handleWordleBotScrapeError(message);

    case MessageType.GET_WORDLE_BOT_SCRAPE_STATUS:
      return handleGetWordleBotScrapeStatus();
      
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
    
    // Calculate stats for the requested time frame
    const filteredGames = filterGamesByTimeFrame(games, message.timeFrame);
    const statistics = calculateStatistics(filteredGames, games);
    
    // Get the most recent game
    let lastGame = null;
    if (games.length > 0) {
      const sortedGames = [...games].sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      lastGame = sortedGames[0];
    }
    
    return {
      success: true,
      statistics,
      lastGame,
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
    // Initialize storage service if not available
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    
    // For incremental mode, find the newest game we have and stop when we reach it
    // This avoids deep scanning once all recent games are imported
    let stopAtDate: string | undefined;
    
    if (message.mode === 'incremental' || message.mode === 'auto') {
      const allGames = await storageService.getAllGames();
      if (allGames.length > 0) {
        // Find newest game date
        const dates = allGames.map(g => g.date).filter(d => d).sort();
        stopAtDate = dates[dates.length - 1]; // Newest date
      }
    }
    
    // Store scrape parameters in storage for content script to pick up
    await chrome.storage.local.set({
      wordleBotScrapeParams: {
        mode: message.mode,
        stopAtDate,
        maxIterations: message.maxIterations || 50,
        timestamp: Date.now()
      }
    });
    
    // Open WordleBot page in background tab
    const tab = await chrome.tabs.create({
      url: 'https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html',
      active: false
    });
    
    scraperTabId = tab.id || null;

    await updateScrapeStatus({
      phase: 'checking',
      gamesFound: 0,
      gamesProcessed: 0,
      newGames: 0,
      duplicates: 0,
      errors: 0,
      mode: message.mode,
      error: null,
      statusMessage: 'Checking for latest games'
    });
    
    return { success: true, ...(scraperTabId ? { tabId: scraperTabId } : {}), message: 'Scraping started' };
  } catch (error) {
    console.error('[Background] Failed to start WordleBot scrape:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateScrapeStatus({
      phase: 'error',
      statusMessage: 'Failed to start scrape',
      error: errorMessage
    });
    // Close the scraper tab on error
    if (scraperTabId) {
      chrome.tabs.remove(scraperTabId).catch(() => {});
      scraperTabId = null;
    }
    throw error;
  }
}

async function handleGetWordleBotScrapeStatus(): Promise<WordleBotScrapeStatusResponse> {
  console.log('[Background] GET_WORDLE_BOT_SCRAPE_STATUS requested, returning:', currentScrapeStatus);
  return {
    success: true,
    status: {
      ...currentScrapeStatus
    }
  };
}

async function handleBulkImportGames(games: GameResult[]): Promise<{ success: boolean; imported: number; duplicates: number; errors: number }> {
  try {
    console.log(`[Background] =====> handleBulkImportGames called with ${games.length} games`);
    const startTime = performance.now();
    
    if (!storageService) {
      console.log(`[Background] =====> Initializing storage service...`);
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
      console.log(`[Background] =====> Storage service initialized`);
    }
    
    console.log(`[Background] =====> Calling storageService.bulkImportGames...`);
    const result = await storageService.bulkImportGames(games);
    const duration = (performance.now() - startTime).toFixed(0);
    console.log(`[Background] =====> Bulk import complete in ${duration}ms:`, result);
    
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

  const progressStatusMessage = (() => {
    const gamesFound = message.gamesFound ?? currentScrapeStatus.gamesFound ?? 0;
    const gamesProcessed = message.gamesProcessed ?? currentScrapeStatus.gamesProcessed ?? 0;

    switch (message.status) {
      case 'ready':
        return gamesFound > 0
          ? `Found ${gamesFound} game${gamesFound === 1 ? '' : 's'}. Preparing import...`
          : 'Preparing import...';
      case 'processing':
        return `Processing games (${gamesProcessed}/${gamesFound})`;
      case 'processed':
        return 'All games processed. Finalizing...';
      case 'loading':
        return `Importing ${gamesFound} game${gamesFound === 1 ? '' : 's'}...`;
      default:
        return 'Importing games';
    }
  })();

  await updateScrapeStatus({
    phase: 'importing',
    gamesFound: message.gamesFound ?? currentScrapeStatus.gamesFound,
    gamesProcessed: message.gamesProcessed ?? currentScrapeStatus.gamesProcessed,
    duplicates: message.duplicatesSkipped ?? currentScrapeStatus.duplicates,
    statusMessage: progressStatusMessage,
    error: null
  });
  
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
  try {
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    await storageService.updateScraperMetadata({
      lastScrape: new Date().toISOString(),
      lastScrapeMode: 'auto', // TODO: derive real mode from message when available
      totalScraped: message.totalGames
    });
  } catch (metadataError) {
    console.error('[Background] Failed to update scraper metadata after completion:', metadataError);
  }
  
  // Close the scraper tab after a short delay to allow user to see completion
  if (scraperTabId) {
    setTimeout(() => {
      if (scraperTabId) {
        chrome.tabs.remove(scraperTabId).catch(() => {});
        scraperTabId = null;
      }
    }, 2000);
  }
  
  await updateScrapeStatus({
    phase: 'complete',
    gamesFound: message.totalGames ?? currentScrapeStatus.gamesFound,
    gamesProcessed: message.totalGames ?? currentScrapeStatus.gamesProcessed,
    newGames: message.newGames ?? currentScrapeStatus.newGames,
    duplicates: message.duplicates ?? currentScrapeStatus.duplicates,
    errors: message.errors ?? currentScrapeStatus.errors,
    statusMessage: message.newGames && message.newGames > 0
      ? `Added ${message.newGames} new game${message.newGames === 1 ? '' : 's'}`
      : 'Scrape complete',
    error: null,
    dateRange: message.dateRange ?? currentScrapeStatus.dateRange
  });

  // Forward to popup/dashboard (restored from working version)
  console.log('[Background] Forwarding COMPLETE message to popup');
  try {
    await chrome.runtime.sendMessage(message);
    console.log('[Background] COMPLETE message forwarded successfully');
  } catch (err) {
    console.log('[Background] Could not forward to popup:', err);
  }
  
  setTimeout(() => {
    updateScrapeStatus({
      phase: 'idle',
      gamesFound: 0,
      gamesProcessed: 0,
      newGames: 0,
      duplicates: 0,
      errors: 0,
      statusMessage: 'Idle',
      error: null,
      dateRange: null,
      mode: null
    }).catch(() => {
      // Best effort reset; ignore failures.
    });
  }, 5000);

  return { success: true };
}

async function handleWordleBotScrapeError(message: any): Promise<{ success: boolean }> {
  console.error('[Background] Scrape error:', message);
  
  // Update scraper metadata
  try {
    if (!storageService) {
      storageService = ExtensionStorage.getInstance();
      await storageService.initialize();
    }
    await storageService.updateScraperMetadata({
      lastError: message.error
    });
  } catch (metadataError) {
    console.error('[Background] Failed to update scraper metadata after error:', metadataError);
  }
  
  // Close the scraper tab on error
  if (scraperTabId) {
    chrome.tabs.remove(scraperTabId).catch(() => {});
    scraperTabId = null;
  }
  
  await updateScrapeStatus({
    phase: 'error',
    statusMessage: message.error
      ? `Scrape failed: ${message.error}`
      : 'Scrape failed',
    error: message.error ?? 'Unknown error',
    errors: currentScrapeStatus.errors + 1
  });

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
  
  const filtered = games.filter((game: any) => {
    if (!game.date) return false;
    const gameDate = new Date(game.date);
    return gameDate >= cutoffDate;
  });
  
  return filtered;
}

function calculateStatistics(games: any[], allGames?: any[]): any {
  if (games.length === 0) {
    return {
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      gameCount: 0,
      winCount: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0, 0]
    };
  }
  
  const getAttemptCount = (game: any): number => {
    if (typeof game.attempts === 'number') return game.attempts;
    if (typeof game.guesses === 'number') return game.guesses;
    if (typeof game.steps === 'number') return game.steps;
    return 0;
  };

  const playedGames = games.filter(game => getAttemptCount(game) > 0);

  if (playedGames.length === 0) {
    return {
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      gameCount: 0,
      winCount: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0, 0]
    };
  }

  const wins = playedGames.filter(game => game.won);
  const winRate = (wins.length / playedGames.length) * 100;
  
  const totalGuesses = wins.reduce((sum, game) => sum + getAttemptCount(game), 0);
  const averageGuesses = wins.length > 0 ? totalGuesses / wins.length : 0;

  const guessDistribution = [0, 0, 0, 0, 0, 0, 0];
  for (const game of playedGames) {
    const attempts = getAttemptCount(game);
    if (!game.won) {
      guessDistribution[6] = (guessDistribution[6] ?? 0) + 1;
      continue;
    }

    if (attempts >= 1 && attempts <= 6) {
      const index = attempts - 1;
      guessDistribution[index] = (guessDistribution[index] ?? 0) + 1;
    }
  }
  
  // Use all games for streak calculation if provided, otherwise use filtered games
  const gamesToUseForStreaks = allGames || games;
  
  // Filter out unplayed games (attempts=0 or null) before calculating streaks
  const playedGamesForStreaks = gamesToUseForStreaks.filter(game => 
    getAttemptCount(game) > 0
  );
  
  const sortedAllGames = [...playedGamesForStreaks].sort((a, b) => 
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
  
  return {
    winRate,
    averageGuesses,
    currentStreak,
    maxStreak,
    gameCount: playedGames.length,
    winCount: wins.length,
    guessDistribution
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

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === dashboardTabId) {
    dashboardTabId = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === dashboardTabId && tab.url && !tab.url.includes('dashboard.html')) {
    dashboardTabId = null;
  }
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('dashboard.html')) {
    dashboardTabId = tabId;
  }
});

async function handleOpenDashboardTab(_message: OpenDashboardTabMessage): Promise<OpenDashboardTabResponse> {
  const dashboardUrl = chrome.runtime.getURL('dashboard.html');
  const dashboardPattern = `chrome-extension://${chrome.runtime.id}/dashboard.html*`;

  // Try cached tab first
  if (dashboardTabId !== null) {
    try {
      const existingTab = await chrome.tabs.get(dashboardTabId);
      if (existingTab?.url?.startsWith(dashboardUrl) && existingTab.id !== undefined) {
        if (existingTab.windowId !== undefined) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.tabs.reload(existingTab.id);
        return { success: true, reused: true, tabId: existingTab.id };
      }
    } catch (err) {
      dashboardTabId = null;
    }
  }

  // Query for any dashboard tabs currently open
  try {
    const matchingTabs = await chrome.tabs.query({ url: [dashboardPattern] });
    const tabToUse = matchingTabs.find((tab) => tab.id !== undefined);

    if (tabToUse && tabToUse.id !== undefined) {
      dashboardTabId = tabToUse.id;
      if (tabToUse.windowId !== undefined) {
        await chrome.windows.update(tabToUse.windowId, { focused: true });
      }
      await chrome.tabs.update(tabToUse.id, { active: true });
      await chrome.tabs.reload(tabToUse.id);
      return { success: true, reused: true, tabId: tabToUse.id };
    }
  } catch (queryError) {
    errorLog('[Background] Failed to query dashboard tabs:', queryError);
  }

  // Create new dashboard tab as fallback
  const createdTab = await chrome.tabs.create({ url: dashboardUrl });
  dashboardTabId = createdTab.id ?? null;
  return { success: true, reused: false, tabId: createdTab.id ?? undefined };
}