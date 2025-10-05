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
      return await forwardToContentScript(message, sender);
      
    case 'WORDLE_BOT_SCRAPE_PROGRESS':
      return await handleWordleBotScrapeProgress(message);
      
    case 'WORDLE_BOT_SCRAPE_COMPLETE':
      return await handleWordleBotScrapeComplete(message);
      
    case 'WORDLE_BOT_SCRAPE_ERROR':
      return await handleWordleBotScrapeError(message);
      
    case 'BULK_IMPORT_GAMES':
      return await handleBulkImportGames(message.games);
      
    case 'CONTENT_SCRIPT_READY':
      console.log('[BACKGROUND DEBUG] Content script ready signal received');
      return { received: true };
      
    case 'TEST_SELF_MESSAGE':
      console.log('[BACKGROUND DEBUG] Test self message received');
      return { received: true };
      
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Forward message to content script on WordleBot page
async function forwardToContentScript(message, sender) {
  console.log('[BACKGROUND DEBUG] Forwarding START_WORDLE_BOT_SCRAPE to content script');
  
  try {
    // Find the WordleBot tab
    const tabs = await chrome.tabs.query({
      url: "https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html"
    });
    
    if (tabs.length === 0) {
      throw new Error('WordleBot tab not found. Please open the WordleBot page first.');
    }
    
    const tab = tabs[0];
    console.log('[BACKGROUND DEBUG] Found WordleBot tab:', tab.id);
    
    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, message);
    console.log('[BACKGROUND DEBUG] Content script response:', response);
    
    return response;
  } catch (error) {
    console.error('[BACKGROUND DEBUG] Failed to forward to content script:', error);
    throw error;
  }
}

// Bulk import games handler
async function handleBulkImportGames(games) {
  console.log('[BACKGROUND DEBUG] Bulk importing', games.length, 'games');
  console.log('[BACKGROUND DEBUG] Sample import game:', games[0]);
  
  try {
    // Get existing games
    const result = await chrome.storage.local.get(['games']);
    const existingGames = result.games || [];
    
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    
    for (const game of games) {
      try {
        // Check for duplicates (by date and solution)
        const isDuplicate = existingGames.some(existing => 
          existing.date === game.date && existing.solution === game.solution
        );
        
        if (isDuplicate) {
          duplicates++;
        } else {
          // Ensure all required fields are present
          const gameToStore = {
            ...game,
            // Make sure stats fields are preserved
            isWin: game.isWin ?? game.won ?? true,
            guesses: game.guesses ?? game.attempts ?? null,
            won: game.won ?? game.isWin ?? true,
            attempts: game.attempts ?? game.guesses ?? null
          };
          
          console.log('[BACKGROUND DEBUG] Storing game:', {
            solution: gameToStore.solution,
            isWin: gameToStore.isWin,
            guesses: gameToStore.guesses,
            won: gameToStore.won,
            attempts: gameToStore.attempts
          });
          
          existingGames.push(gameToStore);
          imported++;
        }
      } catch (error) {
        console.error('[BACKGROUND DEBUG] Error processing game:', error);
        errors++;
      }
    }
    
    // Store updated games
    await chrome.storage.local.set({ games: existingGames });
    console.log('[BACKGROUND DEBUG] Stored', existingGames.length, 'total games');
    
    return {
      success: true,
      imported,
      duplicates,
      errors,
      totalGames: existingGames.length
    };
  } catch (error) {
    console.error('[BACKGROUND DEBUG] Bulk import failed:', error);
    return {
      success: false,
      error: error.message,
      imported: 0,
      duplicates: 0,
      errors: games.length
    };
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
  
  console.log('[BACKGROUND DEBUG] Stats calculation for', games.length, 'games');
  console.log('[BACKGROUND DEBUG] Sample game data:', games.slice(0, 2).map(g => ({
    date: g.date,
    isWin: g.isWin,
    won: g.won,
    guesses: g.guesses,
    attempts: g.attempts,
    solution: g.solution
  })));
  
  const wins = games.filter(game => game.isWin ?? game.won);
  console.log('[BACKGROUND DEBUG] Found', wins.length, 'wins out of', games.length, 'games');
  const winRate = (wins.length / games.length) * 100;
  
  // Calculate average guesses (only for wins)  
  const validGuesses = wins.filter(game => {
    const attempts = game.guesses ?? game.attempts;
    return attempts && attempts > 0;
  });
  console.log('[BACKGROUND DEBUG] Found', validGuesses.length, 'games with valid guesses');
  const guessesSum = validGuesses.reduce((sum, game) => sum + (game.guesses ?? game.attempts), 0);
  const averageGuesses = validGuesses.length > 0 ? (guessesSum / validGuesses.length) : 0;
  
  console.log('[BACKGROUND DEBUG] Guesses sum:', guessesSum, 'Valid count:', validGuesses.length, 'Average:', averageGuesses);
  console.log('[BACKGROUND DEBUG] Final stats:', {
    gameCount: games.length,
    winRate: Math.round(winRate * 10) / 10,
    averageGuesses: Math.round(averageGuesses * 10) / 10,
    wins: wins.length
  });
  
  // Calculate guess distribution
  const distribution = [0, 0, 0, 0, 0, 0, 0]; // Index 0 = failed, 1-6 = guesses
  games.forEach(game => {
    const isWin = game.isWin ?? game.won;
    const attempts = game.guesses ?? game.attempts;
    
    if (!isWin) {
      distribution[0]++; // Failed
    } else if (attempts && attempts >= 1 && attempts <= 6) {
      distribution[attempts]++;
    }
  });
  
  // Calculate streaks (simplified - would need proper date sorting for accuracy)
  const sortedGames = games.sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentStreak = 0;
  let maxStreak = 0;
  let streak = 0;
  
  for (let i = sortedGames.length - 1; i >= 0; i--) {
    const isWin = sortedGames[i].isWin ?? sortedGames[i].won;
    if (isWin) {
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