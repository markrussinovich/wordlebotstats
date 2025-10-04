// Content script for WordleBot page scraping
// This handles the background scraping functionality

console.log('[WordleBotContent] WordleBot content script loaded');

// Check if we're on the WordleBot page
if (window.location.href.includes('wordle-bot.html')) {
  console.log('[WordleBotContent] On WordleBot page, initializing scraper...');
  
  // Simple scraper implementation without complex imports
  class SimpleWordleBotScraper {
    constructor() {
      this.isRunning = false;
      this.gamesProcessed = 0;
      this.setupMessageListener();
    }
    
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[WordleBotContent] Received message:', message);
        
        if (message.type === 'START_WORDLE_BOT_SCRAPE') {
          console.log('[WordleBotContent] Starting scrape...');
          this.startScraping(message.mode, message.stopAtDate, message.maxIterations)
            .then(() => {
              console.log('[WordleBotContent] Scrape completed');
              sendResponse({ success: true });
            })
            .catch(error => {
              console.error('[WordleBotContent] Scrape failed:', error);
              sendResponse({ success: false, error: error.message });
            });
          return true;
        }
      });
    }
    
    async startScraping(mode, stopAtDate, maxIterations = 10) {
      if (this.isRunning) {
        console.log('[WordleBotContent] Already running');
        return;
      }
      
      this.isRunning = true;
      console.log('[WordleBotContent] Starting scrape in mode:', mode);
      
      try {
        // Send progress message
        chrome.runtime.sendMessage({
          type: 'WORDLE_BOT_SCRAPE_PROGRESS',
          gamesFound: 0,
          gamesProcessed: 0,
          status: 'scanning'
        });
        
        console.log('[WordleBotContent] Current URL:', window.location.href);
        console.log('[WordleBotContent] Page title:', document.title);
        console.log('[WordleBotContent] Document ready state:', document.readyState);
        
        // Wait for page to be fully loaded
        if (document.readyState !== 'complete') {
          console.log('[WordleBotContent] Waiting for page to load...');
          await new Promise(resolve => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve, { once: true });
            }
          });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait
        }
        
        // Try multiple selectors for game elements
        const possibleSelectors = [
          '.rating-container.svelte-pnoxcy', // Original selector
          '.rating-container',
          '[class*="rating"]',
          '[class*="game"]',
          '[class*="result"]',
          '[class*="score"]',
          'article[class*="game"]',
          'div[class*="game"]',
          '.game-row',
          '.game-card',
          '[data-testid*="game"]',
          'section[class*="svelte"]',
          'div[class*="svelte"]'
        ];
        
        let gameCards = [];
        let foundSelector = null;
        
        for (const selector of possibleSelectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`[WordleBotContent] Selector "${selector}": found ${elements.length} elements`);
          
          if (elements.length > 0) {
            // Check if any elements contain "Wordle" text
            const wordleElements = Array.from(elements).filter(el => 
              el.textContent && el.textContent.toLowerCase().includes('wordle')
            );
            
            if (wordleElements.length > 0) {
              console.log(`[WordleBotContent] Found ${wordleElements.length} Wordle-related elements with selector: ${selector}`);
              gameCards = wordleElements;
              foundSelector = selector;
              break;
            }
          }
        }
        
        // If no specific game cards found, look for any text containing "Wordle"
        if (gameCards.length === 0) {
          console.log('[WordleBotContent] No game cards found, searching for any Wordle text...');
          const allElements = document.querySelectorAll('*');
          const wordleElements = Array.from(allElements).filter(el => {
            const text = el.textContent || '';
            return text.toLowerCase().includes('wordle') && text.length > 10 && text.length < 500;
          });
          
          console.log(`[WordleBotContent] Found ${wordleElements.length} elements containing "Wordle" text`);
          
          // Log some examples
          wordleElements.slice(0, 5).forEach((el, i) => {
            console.log(`[WordleBotContent] Wordle element ${i + 1}:`, {
              tagName: el.tagName,
              className: el.className,
              textSnippet: el.textContent.substring(0, 100)
            });
          });
        }
        
        console.log('[WordleBotContent] Final game cards found:', gameCards.length);
        console.log('[WordleBotContent] Using selector:', foundSelector);
        
        if (gameCards.length > 0) {
          // Send completion message
          chrome.runtime.sendMessage({
            type: 'WORDLE_BOT_SCRAPE_COMPLETE',
            totalGames: gameCards.length,
            newGames: gameCards.length,
            duplicates: 0,
            errors: 0,
            selector: foundSelector
          });
        } else {
          // Send error with detailed debug info
          chrome.runtime.sendMessage({
            type: 'WORDLE_BOT_SCRAPE_ERROR',
            error: 'No game cards found on page',
            code: 'PARSE_ERROR',
            recoverable: true,
            debugInfo: {
              url: window.location.href,
              title: document.title,
              selectors_tried: possibleSelectors.length,
              page_ready: document.readyState
            }
          });
        }
        
      } catch (error) {
        console.error('[WordleBotContent] Scraping error:', error);
        chrome.runtime.sendMessage({
          type: 'WORDLE_BOT_SCRAPE_ERROR',
          error: error.message,
          code: 'UNKNOWN',
          recoverable: false
        });
      } finally {
        this.isRunning = false;
      }
    }
  }
  
  // Initialize scraper
  const scraper = new SimpleWordleBotScraper();
  console.log('[WordleBotContent] Scraper initialized');
  
  // Check for auto-start parameters
  setTimeout(async () => {
    try {
      const result = await chrome.storage.local.get(['wordleBotScrapeParams']);
      if (result.wordleBotScrapeParams) {
        console.log('[WordleBotContent] Auto-start parameters found:', result.wordleBotScrapeParams);
        const params = result.wordleBotScrapeParams;
        
        // Clear the parameters so we don't start again
        await chrome.storage.local.remove(['wordleBotScrapeParams']);
        
        // Start scraping automatically
        console.log('[WordleBotContent] Auto-starting scraping...');
        await scraper.startScraping(params.mode, null, params.maxIterations);
      }
    } catch (error) {
      console.error('[WordleBotContent] Failed to check auto-start parameters:', error);
    }
  }, 2000); // Wait 2 seconds for page to load
  
  // Export for debugging
  window.__wordleBotScraper = scraper;
}