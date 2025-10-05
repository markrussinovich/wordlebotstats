// Content script for Wordle Bot history scraping
// Automatically scrapes game history from NYTimes Wordle Bot page

class WordleBotScraper {
  constructor() {
    this.isRunning = false;
    this.shouldStop = false;
    this.gamesProcessed = 0;
    this.duplicatesSkipped = 0;

    // Confirmed selectors from v5
    this.GAME_CARD_SELECTOR = '.rating-container.svelte-pnoxcy';
    this.SHOW_MORE_BUTTON_SELECTOR = '.show-more-button.svelte-151vgtd';
    
    console.log('[WordleBotScraper] Initialized');
    this.setupMessageListener();
  }

  setupMessageListener() {
    console.log('[DEBUG] Setting up message listener...');
    const self = this;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log('[DEBUG] ⚡ MESSAGE RECEIVED:', JSON.stringify(message, null, 2));
      console.log('[DEBUG] Message type:', message.type);
      console.log('[DEBUG] Sender:', _sender);
      
      if (message.type === 'START_WORDLE_BOT_SCRAPE') {
        console.log('[DEBUG] 🚀 STARTING WORDLE BOT SCRAPE!');
        console.log('[DEBUG] Scrape params:', { mode: message.mode, stopAtDate: message.stopAtDate, maxIterations: message.maxIterations });
        
        self.startScraping(message.mode, message.stopAtDate, message.maxIterations)
          .then(() => {
            console.log('[DEBUG] ✅ Scraping completed successfully');
            sendResponse({ success: true });
          })
          .catch(error => {
            console.log('[DEBUG] ❌ Scraping failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Will respond asynchronously
      }
      
      if (message.type === 'TEST_SELF_MESSAGE') {
        console.log('[DEBUG] 🎯 SELF-TEST MESSAGE RECEIVED! Message listener is working!');
        sendResponse({ received: true, timestamp: Date.now() });
        return true;
      }
      
      console.log('[DEBUG] ❓ Unknown message type, ignoring');
      return false;
    });
    
    // Test message listener
    console.log('[DEBUG] Message listener set up. Testing...');
    
    // Also listen for any chrome.runtime messages
    console.log('[DEBUG] Testing chrome.runtime availability...');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('[DEBUG] ✅ chrome.runtime is available');
      console.log('[DEBUG] Extension ID:', chrome.runtime.id);
      
      // Test if the listener is actually registered
      console.log('[DEBUG] Testing message listener registration...');
      setTimeout(() => {
        console.log('[DEBUG] 📣 SELF-TEST: Sending test message to self...');
        chrome.runtime.sendMessage({
          type: 'TEST_SELF_MESSAGE',
          timestamp: Date.now()
        }).catch(error => {
          console.log('[DEBUG] Self-test message failed:', error);
        });
      }, 1000);
      
    } else {
      console.log('[DEBUG] ❌ chrome.runtime not available');
    }
  }

  async waitForCardsToLoad() {
    return new Promise((resolve) => {
      const checkCards = () => {
        const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
        console.log(`[DEBUG] Waiting for cards... found ${cards.length}`);
        
        if (cards.length > 0) {
          console.log('[DEBUG] ✅ Cards loaded successfully');
          resolve(cards.length);
        } else {
          console.log('[DEBUG] ⏳ Still waiting for cards...');
          setTimeout(checkCards, 1000);
        }
      };
      checkCards();
    });
  }

  async startScraping(mode = 'full', stopAtDate, maxIterations = 20) {
    console.log(`[DEBUG] startScraping called with mode=${mode}, stopAtDate=${stopAtDate}, maxIterations=${maxIterations}`);
    if (this.isRunning) {
      console.log('[WordleBotScraper] Already running');
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.gamesProcessed = 0;
    this.duplicatesSkipped = 0;

    console.log(`[WordleBotScraper] Starting ${mode} scrape`);

    try {
      console.log('[DEBUG] About to call scrapeAllGames...');
      await this.scrapeAllGames(stopAtDate, maxIterations);
      console.log('[DEBUG] scrapeAllGames completed successfully');
    } catch (error) {
      console.log('[DEBUG] Error in scrapeAllGames:', error);
      console.error('[WordleBotScraper] Error during scraping:', error);
      this.sendError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN',
        false
      );
    } finally {
      this.isRunning = false;
    }
  }

  async scrapeAllGames(stopAtDate, maxIterations = 20) {
    console.log(`[DEBUG] scrapeAllGames starting with maxIterations=${maxIterations}`);
    
    // Wait for cards to be available
    console.log('[DEBUG] Waiting for cards to be available before scraping...');
    await this.waitForCardsToLoad();
    console.log('[DEBUG] Cards are ready, starting scraping process...');
    
    const allGames = new Map();
    let iteration = 0;

    while (iteration < maxIterations && !this.shouldStop) {
      iteration++;
      
      // Extract games from current page
      console.log(`[DEBUG] Iteration ${iteration}: About to extract visible games...`);
      const games = this.extractVisibleGames();
      console.log(`[WordleBotScraper] Iteration ${iteration}: Found ${games.length} games`);
      console.log(`[DEBUG] Games extracted:`, games.slice(0, 3).map(g => ({ solution: g.solution, skillScore: g.skillScore, date: g.date })));

      // Add to collection
      let newGamesThisIteration = 0;
      for (const game of games) {
        const key = game.gameNumber?.toString() || game.date || game.solution || '';
        if (key && !allGames.has(key)) {
          allGames.set(key, game);
          newGamesThisIteration++;
          
          // Check if we've reached the stop date
          if (stopAtDate && game.date && game.date <= stopAtDate) {
            console.log(`[WordleBotScraper] Reached stop date: ${stopAtDate}`);
            this.shouldStop = true;
            break;
          }
        }
      }

      // Send progress update
      this.sendProgress(allGames.size, this.gamesProcessed, 'scanning');

      // Try to load more games
      if (!this.shouldStop) {
        const hasMore = await this.loadMoreGames();
        if (!hasMore) {
          console.log('[WordleBotScraper] No more games to load');
          break;
        }
      }
    }

    if (iteration >= maxIterations) {
      console.warn(`[WordleBotScraper] Stopped at max iterations (${maxIterations})`);
    }

    // Convert and send games
    await this.processAndSendGames(Array.from(allGames.values()));
  }

  extractVisibleGames() {
    console.log('[DEBUG] Starting extractVisibleGames...');
    const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
    console.log(`[DEBUG] Found ${cards.length} cards with selector: ${this.GAME_CARD_SELECTOR}`);
    const games = [];

    cards.forEach((card, idx) => {
      console.log(`[DEBUG] Processing card ${idx}...`);
      try {
        const game = this.extractGameFromCard(card);
        console.log(`[DEBUG] Card ${idx} extraction result:`, JSON.stringify(game, null, 2));
        if (game.solution || game.gameNumber) {
          games.push(game);
          console.log(`[DEBUG] ✅ Card ${idx} added to games array`);
        } else {
          console.log(`[DEBUG] ❌ Card ${idx} skipped - no solution or gameNumber`);
        }
      } catch (error) {
        console.error('[WordleBotScraper] Error extracting game:', error);
        console.error('[DEBUG] Error details:', error.stack);
      }
    });

    console.log(`[DEBUG] Returning ${games.length} games from extractVisibleGames`);
    return games;
  }

  extractGameFromCard(card) {
    const game = {};
    const fullText = card.textContent || '';
    console.log(`[DEBUG] Extracting from card text (length ${fullText.length}):`, fullText.slice(0, 100));

    // Extract solution word
    const solutionMatch = fullText.match(/solution was:\s*([a-z]{5})/i);
    console.log(`[DEBUG] Solution match:`, solutionMatch);
    if (solutionMatch && solutionMatch[1]) {
      game.solution = solutionMatch[1].toUpperCase();
      console.log(`[DEBUG] ✅ Solution extracted: ${game.solution}`);
    } else {
      console.log(`[DEBUG] ❌ Solution not found`);
    }

    // Extract date
    const dateMatch = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
    if (dateMatch && dateMatch[1] && dateMatch[2]) {
      game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
      
      const month = dateMatch[1];
      const day = parseInt(dateMatch[2], 10);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      
      let testDate = new Date(`${month} ${day}, ${currentYear}`);
      if (testDate > currentDate) {
        testDate = new Date(`${month} ${day}, ${currentYear - 1}`);
      }
      
      const isoDate = testDate.toISOString().split('T')[0];
      if (isoDate) {
        game.date = isoDate;
      }
    }

    // Extract game number
    const gameNumMatch = fullText.match(/Game Number[^:]*:\s*(\d{3,4})|#(\d{3,4})|Wordle\s+(\d{3,4})/i);
    if (gameNumMatch) {
      const numStr = gameNumMatch[1] || gameNumMatch[2] || gameNumMatch[3];
      if (numStr) {
        game.gameNumber = parseInt(numStr, 10);
      }
    }

    // Extract skill score
    const skillMatch = fullText.match(/Your score was: (\d{1,3})/i);
    if (skillMatch && skillMatch[1]) {
      game.skillScore = parseInt(skillMatch[1], 10);
    }

    // Extract luck score
    const luckMatch = fullText.match(/Your luck was: (\d{1,3})/i);
    if (luckMatch && luckMatch[1]) {
      game.luckScore = parseInt(luckMatch[1], 10);
    }

    // Extract steps
    const stepsMatch = fullText.match(/It took you: (\d+)guesses/i);
    if (stepsMatch && stepsMatch[1]) {
      game.steps = parseInt(stepsMatch[1], 10);
      game.won = true;
    }

    // Get analysis link
    const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
    if (link && !link.getAttribute('href')?.includes('index.html')) {
      game.analysisUrl = link.href;
    }

    return game;
  }

  async loadMoreGames() {
    const btn = document.querySelector(this.SHOW_MORE_BUTTON_SELECTOR);
    if (!btn || btn.offsetParent === null) {
      return false;
    }

    const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
    btn.click();
    
    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
    const newCards = afterCount - beforeCount;
    
    return newCards > 0;
  }

  async processAndSendGames(rawGames) {
    console.log(`[WordleBotScraper] Processing ${rawGames.length} games`);
    
    // Sort by game number (newest first)
    const sortedGames = rawGames.sort((a, b) => {
      const aNum = a.gameNumber || 0;
      const bNum = b.gameNumber || 0;
      return bNum - aNum;
    });

    // Convert to GameResult format
    const gameResults = sortedGames.map(raw => this.convertToGameResult(raw));

    // Send games in batches to avoid overwhelming the background script
    const batchSize = 10;
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (let i = 0; i < gameResults.length; i += batchSize) {
      const batch = gameResults.slice(i, i + batchSize);
      
      this.sendProgress(
        gameResults.length,
        i,
        'processing'
      );

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'BULK_IMPORT_GAMES',
          games: batch
        });

        if (response.success) {
          imported += response.imported || 0;
          duplicates += response.duplicates || 0;
          errors += response.errors || 0;
        }
      } catch (error) {
        console.error('[WordleBotScraper] Error sending batch:', error);
        errors += batch.length;
      }
    }

    // Send completion message
    this.sendComplete(imported, duplicates, errors, sortedGames);
  }

  convertToGameResult(raw) {
    const now = new Date();
    const dateString = raw.date ?? now.toISOString().split('T')[0];
    const date = dateString;
    
    return {
      date,
      ...(raw.gameNumber && { gameNumber: raw.gameNumber }),
      won: raw.won ?? true,
      attempts: raw.steps ?? null,
      hardMode: false, // WordleBot doesn't track this
      ...(raw.solution && { solution: raw.solution }),
      ...(raw.skillScore !== undefined && { skillScore: raw.skillScore }),
      ...(raw.luckScore !== undefined && { luckScore: raw.luckScore }),
      ...(raw.analysisUrl && { analysisUrl: raw.analysisUrl }),
      scrapedFrom: 'wordle-bot',
      source: 'wordle-page',
      importedAt: now.toISOString(),
      wordLength: 5,
      maxGuesses: 6
    };
  }

  sendProgress(gamesFound, gamesProcessed, status) {
    const message = {
      type: 'WORDLE_BOT_SCRAPE_PROGRESS',
      gamesFound,
      gamesProcessed,
      duplicatesSkipped: this.duplicatesSkipped,
      status
    };

    chrome.runtime.sendMessage(message).catch(error => {
      console.error('[WordleBotScraper] Error sending progress:', error);
    });
  }

  sendComplete(imported, duplicates, errors, games) {
    const message = {
      type: 'WORDLE_BOT_SCRAPE_COMPLETE',
      totalGames: games.length,
      newGames: imported,
      duplicates,
      errors
    };
    
    if (games.length > 0) {
      const oldestGame = games[games.length - 1];
      const newestGame = games[0];
      
      if (oldestGame?.date && newestGame?.date) {
        message.dateRange = {
          oldest: oldestGame.date,
          newest: newestGame.date
        };
      }
    }

    chrome.runtime.sendMessage(message).catch(error => {
      console.error('[WordleBotScraper] Error sending completion:', error);
    });
  }

  sendError(error, code, recoverable) {
    const message = {
      type: 'WORDLE_BOT_SCRAPE_ERROR',
      error,
      code,
      recoverable
    };

    chrome.runtime.sendMessage(message).catch(err => {
      console.error('[WordleBotScraper] Error sending error message:', err);
    });
  }
}

// Test basic message listener BEFORE class setup
console.log('[DEBUG] 🧪 Testing basic message listener setup...');
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('[DEBUG] ✅ chrome.runtime available, adding basic test listener');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[DEBUG] 🔥 BASIC LISTENER: Message received!', message.type);
    if (message.type === 'START_WORDLE_BOT_SCRAPE') {
      console.log('[DEBUG] 🎯 BASIC LISTENER: Got START_WORDLE_BOT_SCRAPE message!');
      sendResponse({ basicListener: true, timestamp: Date.now() });
      return true;
    }
  });
} else {
  console.log('[DEBUG] ❌ chrome.runtime not available for basic listener');
}

// Initialize scraper
const scraper = new WordleBotScraper();

// Auto-start if in background mode
if (!document.hasFocus()) {
  console.log('[WordleBotScraper] Background mode detected, auto-starting');
  // Will be triggered by message from background script
}

// Add manual test function for debugging
console.log('[DEBUG] Adding manual test function to window');
window.__testWordleBotScraper = () => {
  console.log('[DEBUG] Manual test triggered!');
  console.log('[DEBUG] Testing immediate extraction...');
  const games = scraper.extractVisibleGames();
  console.log('[DEBUG] Manual test found', games.length, 'games');
  return games;
};

// Add manual scraping trigger
window.__triggerManualScrape = async () => {
  console.log('[DEBUG] 🔥 MANUAL SCRAPE TRIGGER!');
  try {
    await scraper.startScraping('full', null, 2);
    console.log('[DEBUG] ✅ Manual scrape completed');
  } catch (error) {
    console.log('[DEBUG] ❌ Manual scrape failed:', error);
  }
};

// Test sending a message to background script
window.__testMessageToBackground = () => {
  console.log('[DEBUG] 📤 Testing message to background...');
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'TEST_MESSAGE',
      from: 'content_script',
      timestamp: Date.now()
    }).then(response => {
      console.log('[DEBUG] 📥 Background response:', response);
    }).catch(error => {
      console.log('[DEBUG] ❌ Message failed:', error);
    });
  }
};

// Simulate receiving a START_WORDLE_BOT_SCRAPE message  
window.__simulatePopupMessage = () => {
  console.log('[DEBUG] 🎭 Simulating popup message...');
  const mockMessage = {
    type: 'START_WORDLE_BOT_SCRAPE',
    mode: 'full',
    stopAtDate: null,
    maxIterations: 2
  };
  
  // Trigger the same handler that should receive the real message
  chrome.runtime.onMessage.dispatch(mockMessage, { tab: { id: 'test' } }, (response) => {
    console.log('[DEBUG] 📥 Simulated message response:', response);
  });
};

// Wait for page content to load
console.log('[DEBUG] Waiting for page content to load...');

const waitForCards = () => {
  return new Promise((resolve) => {
    const checkCards = () => {
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      console.log(`[DEBUG] Checking for cards... found ${cards.length}`);
      
      if (cards.length > 0) {
        console.log('[DEBUG] ✅ Cards found! Page is ready.');
        resolve(cards.length);
      } else {
        console.log('[DEBUG] ⏳ No cards yet, checking again in 1 second...');
        setTimeout(checkCards, 1000);
      }
    };
    checkCards();
  });
};

// Test extraction once cards are available
waitForCards().then((cardCount) => {
  console.log(`[DEBUG] Page loaded with ${cardCount} cards. Testing extraction...`);
  const testGames = scraper.extractVisibleGames();
  console.log(`[DEBUG] Initial test found ${testGames.length} games`);
  
  // Signal to background that content script is ready
  console.log('[DEBUG] 📢 Signaling that content script is ready...');
  try {
    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      url: window.location.href,
      cardsFound: cardCount,
      timestamp: Date.now()
    }).then(() => {
      console.log('[DEBUG] ✅ Ready signal sent successfully');
    }).catch(error => {
      console.log('[DEBUG] ❌ Ready signal failed:', error);
    });
  } catch (error) {
    console.log('[DEBUG] ❌ chrome.runtime not available:', error);
  }
});

// Export for debugging
if (typeof window !== 'undefined') {
  window.__wordleBotScraper = scraper;
}