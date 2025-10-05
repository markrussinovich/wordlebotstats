// WordleBot content script for scraping game data
console.log('[WordleBotScraper] WordleBot content script loaded');

class WordleBotScraper {
  constructor() {
    this.scraped = [];
    this.maxIterations = 10;
    this.currentIteration = 0;
    this.running = false;
    this.stopAtDate = null;
    console.log('[WordleBotScraper] Initialized');
    
    // Auto-start based on storage params
    this.checkAutoStart();
  }

  async checkAutoStart() {
    try {
      const params = await chrome.storage.local.get(['wordleBotScrapeParams']);
      if (params.wordleBotScrapeParams && params.wordleBotScrapeParams.timestamp) {
        const now = Date.now();
        const paramTime = params.wordleBotScrapeParams.timestamp;
        
        // If params are less than 30 seconds old, auto-start
        if (now - paramTime < 30000) {
          console.log('[WordleBotScraper] Auto-starting scraper with params:', params.wordleBotScrapeParams);
          this.maxIterations = params.wordleBotScrapeParams.maxIterations || 10;
          
          // Wait for page to be ready
          setTimeout(() => {
            this.startScraping();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('[WordleBotScraper] Error checking auto-start:', error);
    }
  }

  startScraping() {
    if (this.running) {
      console.log('[WordleBotScraper] Already running');
      return;
    }

    console.log('[WordleBotScraper] Starting scrape process');
    this.running = true;
    this.currentIteration = 0;
    this.scraped = [];
    this.scrapeCurrentPage();
  }

  scrapeCurrentPage() {
    console.log(`[WordleBotScraper] Scraping page ${this.currentIteration + 1}/${this.maxIterations}`);
    
    // Wait for content to load
    setTimeout(() => {
      try {
        const cards = this.extractGamesFromCurrentPage();
        console.log(`[WordleBotScraper] Found ${cards.length} cards on page ${this.currentIteration + 1}`);
        
        if (cards.length > 0) {
          this.scraped.push(...cards);
          console.log(`[WordleBotScraper] Total games extracted: ${this.scraped.length}`);
          
          // Send progress update
          this.sendProgressUpdate();
          
          // Check if we should continue
          if (this.shouldContinue()) {
            this.clickLoadMore();
          } else {
            this.completeScraping();
          }
        } else {
          console.log('[WordleBotScraper] No cards found, completing scraping');
          this.completeScraping();
        }
      } catch (error) {
        console.error('[WordleBotScraper] Error scraping page:', error);
        this.sendError(error.message);
      }
    }, 1500); // Wait 1.5 seconds for content to load
  }

  extractGamesFromCurrentPage() {
    const cardSelector = '.rating-container.svelte-pnoxcy';
    const cards = document.querySelectorAll(cardSelector);
    console.log(`[WordleBotScraper] Found ${cards.length} cards using selector: ${cardSelector}`);
    
    const extractedGames = [];
    
    cards.forEach((card, index) => {
      try {
        const game = this.extractGameFromCard(card, index);
        if (game) {
          extractedGames.push(game);
        }
      } catch (error) {
        console.error(`[WordleBotScraper] Error extracting game from card ${index}:`, error);
      }
    });
    
    console.log(`[WordleBotScraper] Successfully extracted ${extractedGames.length} games from ${cards.length} cards`);
    return extractedGames;
  }

  extractGameFromCard(card, index) {
    // Get all text content and debug it
    const fullText = card.textContent || '';
    console.log(`[WordleBotScraper] Card ${index} full text:`, fullText);
    
    // Extract solution word - look for "solution was" pattern
    const solutionMatch = fullText.match(/solution was[:\s]*([A-Z]+)/i);
    const solution = solutionMatch ? solutionMatch[1].toUpperCase() : null;
    
    if (!solution) {
      console.log(`[WordleBotScraper] No solution found in card ${index}`);
      return null;
    }
    
    // Extract date from "Wordle XXX, Month DD, YYYY" pattern
    const dateMatch = fullText.match(/Wordle\s+\d+,\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
    let gameDate = null;
    
    if (dateMatch) {
      try {
        gameDate = new Date(dateMatch[1]).toISOString().split('T')[0];
      } catch (error) {
        console.log(`[WordleBotScraper] Error parsing date: ${dateMatch[1]}`);
      }
    }
    
    if (!gameDate) {
      console.log(`[WordleBotScraper] No valid date found in card ${index}`);
      return null;
    }
    
    // Extract skill and luck scores - updated patterns based on real text
    const skillMatch = fullText.match(/Your score was: (\d{1,3})/i);
    const skillScore = skillMatch ? parseInt(skillMatch[1]) : null;
    
    const luckMatch = fullText.match(/Your luck was: (\d{1,3})/i);
    const luckScore = luckMatch ? parseInt(luckMatch[1]) : null;
    
    // Extract steps (guesses) - updated pattern for concatenated text
    const stepsMatch = fullText.match(/It took you: (\d+)guesses/i);
    const steps = stepsMatch ? parseInt(stepsMatch[1]) : null;
    
    // Check if won (assume won if we have steps data)
    const won = steps !== null && steps <= 6;
    
    const extractedGame = {
      solution: solution,
      date: gameDate,
      won: won,
      isWin: won,
      attempts: steps,
      guesses: steps,
      skillScore: skillScore,
      luckScore: luckScore,
      scrapedFrom: 'wordle-bot',
      source: 'wordle-bot',
      importedAt: new Date().toISOString(),
      hardMode: false,
      wordLength: solution ? solution.length : 5,
      maxGuesses: 6
    };
    
    console.log(`[WordleBotScraper] Extracted game ${index}:`, {
      solution,
      date: gameDate,
      won,
      steps,
      skillScore,
      luckScore
    });
    
    return extractedGame;
  }

  shouldContinue() {
    if (this.currentIteration >= this.maxIterations - 1) {
      console.log('[WordleBotScraper] Reached max iterations');
      return false;
    }
    
    // Check if we should stop at a specific date
    if (this.stopAtDate && this.scraped.length > 0) {
      const newestScraped = this.scraped[this.scraped.length - 1];
      if (newestScraped.date <= this.stopAtDate) {
        console.log(`[WordleBotScraper] Reached stop date: ${this.stopAtDate}`);
        return false;
      }
    }
    
    return true;
  }

  clickLoadMore() {
    const loadMoreSelector = '.show-more-button.svelte-151vgtd';
    const loadMoreButton = document.querySelector(loadMoreSelector);
    
    if (loadMoreButton && loadMoreButton.style.display !== 'none') {
      console.log('[WordleBotScraper] Clicking load more button');
      loadMoreButton.click();
      
      this.currentIteration++;
      
      // Wait for new content to load, then scrape next page
      setTimeout(() => {
        this.scrapeCurrentPage();
      }, 2000);
    } else {
      console.log('[WordleBotScraper] No more load button found, completing scraping');
      this.completeScraping();
    }
  }

  sendProgressUpdate() {
    const message = {
      type: 'WORDLE_BOT_SCRAPE_PROGRESS',
      gamesFound: this.scraped.length,
      currentPage: this.currentIteration + 1,
      maxPages: this.maxIterations
    };
    
    chrome.runtime.sendMessage(message).catch(error => {
      console.log('[WordleBotScraper] Could not send progress update:', error);
    });
  }

  async completeScraping() {
    console.log('[WordleBotScraper] Scraping complete');
    this.running = false;
    
    try {
      if (this.scraped.length > 0) {
        console.log(`[WordleBotScraper] Importing ${this.scraped.length} games to storage`);
        
        const importResponse = await chrome.runtime.sendMessage({
          type: 'BULK_IMPORT_GAMES',
          games: this.scraped
        });
        
        console.log('[WordleBotScraper] Import response:', importResponse);
        
        const completeMessage = {
          type: 'WORDLE_BOT_SCRAPE_COMPLETE',
          totalGames: this.scraped.length,
          newGames: importResponse.imported || 0,
          duplicates: importResponse.duplicates || 0,
          errors: importResponse.errors || 0
        };
        
        chrome.runtime.sendMessage(completeMessage).catch(error => {
          console.log('[WordleBotScraper] Could not send complete message:', error);
        });
      } else {
        console.log('[WordleBotScraper] No games found to import');
        
        chrome.runtime.sendMessage({
          type: 'WORDLE_BOT_SCRAPE_ERROR',
          error: 'No games found on WordleBot page'
        }).catch(() => {});
      }
    } catch (error) {
      console.error('[WordleBotScraper] Error completing scraping:', error);
      this.sendError(error.message);
    }
  }

  sendError(errorMessage) {
    console.error('[WordleBotScraper] Sending error:', errorMessage);
    this.running = false;
    
    chrome.runtime.sendMessage({
      type: 'WORDLE_BOT_SCRAPE_ERROR',
      error: errorMessage
    }).catch(() => {});
  }
}

// Initialize scraper when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WordleBotScraper();
  });
} else {
  new WordleBotScraper();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WordleBotScraper] Received message:', message);
  
  if (message.type === 'START_WORDLE_BOT_SCRAPE') {
    const scraper = new WordleBotScraper();
    scraper.maxIterations = message.maxIterations || 10;
    scraper.stopAtDate = message.stopAtDate;
    scraper.startScraping();
    sendResponse({ success: true });
  }
});

console.log('[WordleBotScraper] Content script initialization complete');