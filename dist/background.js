// Background service worker for Wordle Stats extension
// Simplified version without complex imports

console.log('[Background] Background script loaded');

// Extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);
  
  try {
    if (details.reason === 'install') {
      await chrome.storage.sync.set({
        preferences: {
          theme: 'system',
          defaultTimeFrame: '7d',
          showBenchmarks: true,
          enableNotifications: false,
          autoImport: true
        },
        lastSyncTime: Date.now(),
        version: chrome.runtime.getManifest().version
      });
      console.log('[Background] Extension initialized with default settings');
    }
  } catch (error) {
    console.error('[Background] Extension initialization failed:', error);
  }
});

// Message routing between extension components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  
  return true; // Will respond asynchronously
});

// Handle messages
async function handleExtensionMessage(message, sender) {
  switch (message.type) {
    case 'GET_QUICK_STATS':
      return await handleGetQuickStats(message);
      
    case 'GET_DASHBOARD_DATA':
      return await handleGetDashboardData(message);
      
    case 'START_WORDLE_BOT_SCRAPE':
      return await handleStartWordleBotScrape(message);
      
    case 'WORDLE_BOT_SCRAPE_PROGRESS':
      return await handleWordleBotScrapeProgress(message);
      
    case 'WORDLE_BOT_SCRAPE_COMPLETE':
      return await handleWordleBotScrapeComplete(message);
      
    case 'WORDLE_BOT_SCRAPE_ERROR':
      return await handleWordleBotScrapeError(message);
      
    case 'BULK_IMPORT_GAMES':
      return await handleBulkImportGames(message.games);
      
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Quick stats handler
async function handleGetQuickStats(message) {
  try {
    console.log('[BACKGROUND DEBUG] Getting quick stats for:', message.timeFrame);
    const result = await chrome.storage.local.get(['games']);
    const games = result.games || [];
    
    console.log('[BACKGROUND DEBUG] Found', games.length, 'games in storage');
    
    // Filter games by time frame
    const filteredGames = filterGamesByTimeFrame(games, message.timeFrame);
    console.log('[BACKGROUND DEBUG] Filtered to', filteredGames.length, 'games for timeframe:', message.timeFrame);
    
    // Calculate statistics
    const statistics = calculateStatistics(filteredGames);
    console.log('[BACKGROUND DEBUG] Calculated stats:', statistics);
    
    return {
      success: true,
      statistics: statistics,
      timeFrame: message.timeFrame
    };
  } catch (error) {
    console.error('[BACKGROUND DEBUG] Failed to get quick stats:', error);
    throw error;
  }
}

// Filter games by time frame
function filterGamesByTimeFrame(games, timeFrame) {
  if (timeFrame === 'all') {
    return games;
  }
  
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
  
  return games.filter(game => {
    if (!game.date) return false;
    const gameDate = new Date(game.date);
    return gameDate >= cutoffDate;
  });
}

// Calculate statistics from games
function calculateStatistics(games) {
  if (games.length === 0) {
    return {
      gameCount: 0,
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0, 0]
    };
  }
  
  const wins = games.filter(game => game.isWin);
  const winRate = (wins.length / games.length) * 100;
  
  // Calculate average guesses (only for wins)
  const validGuesses = wins.filter(game => game.guesses && game.guesses > 0);
  const averageGuesses = validGuesses.length > 0 
    ? validGuesses.reduce((sum, game) => sum + game.guesses, 0) / validGuesses.length 
    : 0;
  
  // Calculate guess distribution
  const distribution = [0, 0, 0, 0, 0, 0, 0]; // Index 0 = failed, 1-6 = guesses
  games.forEach(game => {
    if (!game.isWin) {
      distribution[0]++; // Failed
    } else if (game.guesses && game.guesses >= 1 && game.guesses <= 6) {
      distribution[game.guesses]++;
    }
  });
  
  // Calculate streaks (simplified - would need proper date sorting for accuracy)
  const sortedGames = games.sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentStreak = 0;
  let maxStreak = 0;
  let streak = 0;
  
  for (let i = sortedGames.length - 1; i >= 0; i--) {
    if (sortedGames[i].isWin) {
      streak++;
      if (i === sortedGames.length - 1) currentStreak = streak;
    } else {
      maxStreak = Math.max(maxStreak, streak);
      streak = 0;
      if (i === sortedGames.length - 1) currentStreak = 0;
    }
  }
  maxStreak = Math.max(maxStreak, streak);
  
  return {
    gameCount: games.length,
    winRate: Math.round(winRate * 10) / 10,
    averageGuesses: Math.round(averageGuesses * 10) / 10,
    currentStreak,
    maxStreak,
    guessDistribution: distribution
  };
}

// Dashboard data handler
async function handleGetDashboardData(message) {
  try {
    console.log('[BACKGROUND DEBUG] Getting dashboard data');
    const result = await chrome.storage.local.get(['games', 'benchmarks']);
    
    return {
      success: true,
      games: result.games || [],
      benchmarks: result.benchmarks || [],
      preferences: {},
      timeFrames: ['7d', '30d', '90d', 'all']
    };
  } catch (error) {
    console.error('[BACKGROUND DEBUG] Failed to get dashboard data:', error);
    throw error;
  }
}

// WordleBot scraper handlers
let scraperTabId = null;

async function handleStartWordleBotScrape(message) {
  try {
    console.log('[BACKGROUND DEBUG] Starting WordleBot scrape (mode:', message.mode, ')');
    
    // Store scrape parameters for content script to pick up
    await chrome.storage.local.set({
      wordleBotScrapeParams: {
        mode: message.mode,
        maxIterations: message.maxIterations || 10,
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
    
    return { success: true };
    
  } catch (error) {
    console.error('[BACKGROUND DEBUG] Failed to start WordleBot scrape:', error);
    if (scraperTabId) {
      chrome.tabs.remove(scraperTabId).catch(() => {});
      scraperTabId = null;
    }
    throw error;
  }
}

async function handleWordleBotScrapeProgress(message) {
  console.log('[BACKGROUND DEBUG] Scrape progress:', JSON.stringify(message, null, 2));
  // Forward progress to popup
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function handleWordleBotScrapeComplete(message) {
  console.log('[BACKGROUND DEBUG] Scrape complete:', JSON.stringify(message, null, 2));
  
  // Close the scraper tab after delay
  if (scraperTabId) {
    setTimeout(() => {
      if (scraperTabId) {
        chrome.tabs.remove(scraperTabId).catch(() => {});
        scraperTabId = null;
      }
    }, 2000);
  }
  
  // Forward to popup
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function handleWordleBotScrapeError(message) {
  console.error('[BACKGROUND DEBUG] Scrape error:', JSON.stringify(message, null, 2));
  
  // Close the scraper tab
  if (scraperTabId) {
    chrome.tabs.remove(scraperTabId).catch(() => {});
    scraperTabId = null;
  }
  
  // Forward to popup
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function handleBulkImportGames(games) {
  try {
    console.log(`[BACKGROUND DEBUG] Bulk importing ${games.length} games`);
    
    // Simple implementation - just save to storage
    const result = await chrome.storage.local.get(['games']);
    const existingGames = result.games || [];
    const existingIds = new Set(existingGames.map(g => g.gameId || g.date));
    
    const newGames = games.filter(g => !existingIds.has(g.gameId || g.date));
    const allGames = [...existingGames, ...newGames];
    
    await chrome.storage.local.set({ games: allGames });
    
    console.log('[BACKGROUND DEBUG] Bulk import complete:', {
      imported: newGames.length,
      duplicates: games.length - newGames.length,
      errors: 0
    });
    
    return { 
      success: true, 
      imported: newGames.length, 
      duplicates: games.length - newGames.length, 
      errors: 0 
    };
  } catch (error) {
    console.error('[BACKGROUND DEBUG] Failed to bulk import games:', error);
    return { success: false, imported: 0, duplicates: 0, errors: games.length };
  }
}

console.log('[Background] Background script initialization complete');