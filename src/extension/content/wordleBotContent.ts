// Content script for Wordle Bot history scraping
// Automatically scrapes game history from NYTimes Wordle Bot page

import { GameResult } from '@/types/gameTypes';
import { 
  MessageType,
  WordleBotScrapeProgressMessage,
  WordleBotScrapeCompleteMessage,
  WordleBotScrapeErrorMessage 
} from '@/types/messagingTypes';

interface RawGameData {
  solution?: string;
  dateString?: string;
  date?: string;
  gameNumber?: number;
  skillScore?: number;
  luckScore?: number;
  steps?: number;
  won?: boolean;
  analysisUrl?: string;
}

class WordleBotScraper {
  private isRunning = false;
  private shouldStop = false;
  private gamesProcessed = 0;
  private duplicatesSkipped = 0;

  // Confirmed selectors from v5
  private readonly GAME_CARD_SELECTOR = '.rating-container.svelte-pnoxcy';
  private readonly SHOW_MORE_BUTTON_SELECTOR = '.show-more-button.svelte-151vgtd';
  
  constructor() {
    console.log('[WordleBotScraper] Initialized');
    this.setupMessageListener();
    this.checkAutoStart();
  }

  private async checkAutoStart(): Promise<void> {
    try {
      const params = await chrome.storage.local.get(['wordleBotScrapeParams']);
      
      if (params.wordleBotScrapeParams && params.wordleBotScrapeParams.timestamp) {
        const now = Date.now();
        const paramTime = params.wordleBotScrapeParams.timestamp;
        const age = now - paramTime;
        
        // If params are less than 30 seconds old, auto-start
        if (age < 30000) {
          console.log('[WordleBotScraper] Auto-starting scraper...');
          const { mode, stopAtDate, maxIterations } = params.wordleBotScrapeParams;
          
          // Wait for page to be ready
          setTimeout(() => {
            this.startScraping(mode, stopAtDate, maxIterations);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('[WordleBotScraper] Error checking auto-start:', error);
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === MessageType.START_WORDLE_BOT_SCRAPE) {
        this.startScraping(message.mode, message.stopAtDate, message.maxIterations)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
      } else if (message.type === 'GET_NEWEST_PAGE_GAME') {
        this.getNewestPageGame()
          .then(game => sendResponse({ success: true, game }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
      }
      return false;
    });
  }

  async getNewestPageGame(): Promise<RawGameData | null> {
    try {
      const games = this.extractVisibleGames();
      if (games.length === 0) {
        return null;
      }
      
      // Sort by game number or date to find the newest
      const sortedGames = games.sort((a, b) => {
        // Try game number first
        if (a.gameNumber && b.gameNumber) {
          return b.gameNumber - a.gameNumber;
        }
        // Fall back to date
        if (a.date && b.date) {
          return b.date.localeCompare(a.date);
        }
        return 0;
      });
      
      return sortedGames[0] || null;
    } catch (error) {
      console.error('[WordleBotScraper] Error getting newest page game:', error);
      return null;
    }
  }

  async startScraping(
    mode: 'full' | 'incremental' | 'auto',
    stopAtDate?: string,
    maxIterations: number = 50
  ): Promise<void> {
    if (this.isRunning) {
      console.log('[WordleBotScraper] Already running');
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.gamesProcessed = 0;
    this.duplicatesSkipped = 0;

    console.log(`[WordleBotScraper] Starting ${mode} scrape`);
    
    // Send initial progress message
    this.sendProgress(0, 0, 'Opening WordleBot page...');

    try {
      // Start the recursive scraping process
      await this.scrapeWithRetry(stopAtDate, maxIterations, 0, new Map());
    } catch (error) {
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

  private async scrapeWithRetry(
    stopAtDate: string | undefined,
    maxIterations: number,
    iteration: number,
    allGames: Map<string, RawGameData>
  ): Promise<void> {
    if (this.shouldStop || iteration >= maxIterations) {
      console.log('[WordleBotScraper] Stopping: shouldStop=' + this.shouldStop + ', iteration=' + iteration);
      await this.processAndSendGames(Array.from(allGames.values()));
      return;
    }

    // On first iteration, navigate to game history
    if (iteration === 0) {
      console.log('[WordleBotScraper] First iteration - navigating to game history...');
      this.sendProgress(0, 0, 'Navigating to game history...');
      const navigated = await this.navigateToGameHistory();
      if (!navigated) {
        console.error('[WordleBotScraper] Failed to navigate to game history');
        this.sendError('Could not navigate to game history. Please ensure you are logged in.', 'PARSE_ERROR', true);
        return;
      }
    }

    // Wait for page content to load
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Send scanning message on first iteration
    if (iteration === 0) {
      this.sendProgress(0, 0, 'Scanning for games...');
    }

    // Extract games from current page
    const games = this.extractVisibleGames();
    console.log(`[WordleBotScraper] Iteration ${iteration + 1}: Found ${games.length} games`);

    if (games.length === 0 && iteration === 0) {
      // No games on first iteration - might need more time
      console.log('[WordleBotScraper] No games found on first attempt, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.scrapeWithRetry(stopAtDate, maxIterations, iteration, allGames);
    }

    // Add new games to collection
    let newGamesThisIteration = 0;
    let reachedStopDate = false;

    for (const game of games) {
      const key = game.gameNumber?.toString() || game.date || game.solution || '';
      if (key && !allGames.has(key)) {
        allGames.set(key, game);
        newGamesThisIteration++;
      } else if (key && stopAtDate) {
        // If we encounter a duplicate and we have a stopAtDate, it means we've
        // caught up to games we already have - we can stop scraping
        console.log(`[WordleBotScraper] Found duplicate game (${game.date || game.gameNumber}), stopping incremental scrape`);
        reachedStopDate = true;
        break;
      }
      
      // Also check if we've gone past the stop date (for older games)
      if (stopAtDate && game.date && game.date < stopAtDate) {
        console.log(`[WordleBotScraper] Reached date before stop date: ${game.date} < ${stopAtDate}`);
        reachedStopDate = true;
        break;
      }
    }

    console.log(`[WordleBotScraper] Added ${newGamesThisIteration} new games (total: ${allGames.size})`);

    // Send progress update
    this.sendProgress(allGames.size, this.gamesProcessed, 'loading');

    // Stop if we reached the stop date
    if (reachedStopDate) {
      console.log('[WordleBotScraper] Reached stop date, completing scrape');
      await this.processAndSendGames(Array.from(allGames.values()));
      return;
    }

    // Try to click load more button
    const loadedMore = await this.loadMoreGames();
    
    if (loadedMore) {
      // Wait for new content, then scrape again
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.scrapeWithRetry(stopAtDate, maxIterations, iteration + 1, allGames);
    } else {
      // No more games to load
      console.log('[WordleBotScraper] No more games to load');
      await this.processAndSendGames(Array.from(allGames.values()));
    }
  }

  private async navigateToGameHistory(): Promise<boolean> {
    try {
      console.log('[WordleBotScraper] Looking for "Compare and view your recent scores" button...');
      
      // Look for the "Compare and view your recent scores" button
      let compareButton: Element | null = null;
      
      // Retry up to 10 times (10 seconds total) waiting for button to appear
      for (let attempt = 0; attempt < 10; attempt++) {
        // Try text-based search - look for various button texts
        // Include div.action-item which is used by WordleBot
        const allButtons = document.querySelectorAll('button, a, div[role="button"], [class*="button"], div.action-item, .action-item');
        
        for (const btn of Array.from(allButtons)) {
          const text = (btn.textContent || '').trim();
          
          // Look for buttons containing keywords
          const lowerText = text.toLowerCase();
          if (
            (lowerText.includes('compare') && (lowerText.includes('recent') || lowerText.includes('score'))) ||
            (lowerText.includes('view') && lowerText.includes('recent'))
          ) {
            compareButton = btn;
            console.log('[WordleBotScraper] Found navigation button');
            break;
          }
        }
        
        // If found, break out of retry loop
        if (compareButton) {
          break;
        }
        
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (compareButton) {
        console.log('[WordleBotScraper] Clicking "Compare and view your recent scores"...');
        (compareButton as HTMLElement).click();
        
        // Wait for section to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Navigate to the game history section (third dot/section)
        console.log('[WordleBotScraper] Navigating to game history section...');
        
        // Method 1: Click the third slide dot directly
        const slideDots = document.querySelectorAll('.slide-dot');
        if (slideDots.length >= 3) {
          console.log('[WordleBotScraper] Found slide dots, clicking third dot...');
          (slideDots[2] as HTMLElement).click();
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
          if (cards.length > 0) {
            console.log('[WordleBotScraper] ✓ Successfully navigated to game history via slide dot!');
            return true;
          }
        }
        
        // Method 2: Simulate right arrow key presses (press twice to get to third section)
        console.log('[WordleBotScraper] Trying keyboard navigation (right arrow x2)...');
        for (let i = 0; i < 2; i++) {
          const rightArrowEvent = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            code: 'ArrowRight',
            keyCode: 39,
            which: 39,
            bubbles: true
          });
          document.dispatchEvent(rightArrowEvent);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // Check if we reached game history
        await new Promise(resolve => setTimeout(resolve, 1000));
        const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
        if (cards.length > 0) {
          console.log('[WordleBotScraper] ✓ Successfully navigated to game history via keyboard!');
          return true;
        }
        
        // Method 3: Look for next/arrow buttons and click twice
        console.log('[WordleBotScraper] Trying arrow buttons...');
        const arrowButtons = document.querySelectorAll('button[aria-label*="next"], button[aria-label*="right"], .next-button, [class*="arrow"]');
        if (arrowButtons.length > 0) {
          for (let i = 0; i < 2; i++) {
            (arrowButtons[0] as HTMLElement).click();
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          const cardsAfterArrow = document.querySelectorAll(this.GAME_CARD_SELECTOR);
          if (cardsAfterArrow.length > 0) {
            console.log('[WordleBotScraper] ✓ Successfully navigated to game history via arrow button!');
            return true;
          }
        }
        
        console.log('[WordleBotScraper] ✗ Could not navigate to game history section');
        return false;
      } else {
        console.log('[WordleBotScraper] Compare button not found, checking if already on history page...');
        const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
        if (cards.length > 0) {
          console.log('[WordleBotScraper] Already on game history page!');
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('[WordleBotScraper] Error navigating to game history:', error);
      return false;
    }
  }

  private extractVisibleGames(): RawGameData[] {
    const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
    const games: RawGameData[] = [];

    cards.forEach(card => {
      try {
        const game = this.extractGameFromCard(card as HTMLElement);
        if (game.solution || game.gameNumber) {
          games.push(game);
        }
      } catch (error) {
        console.error('[WordleBotScraper] Error extracting game:', error);
      }
    });

    return games;
  }

  private extractGameFromCard(card: HTMLElement): RawGameData {
    const game: RawGameData = {};
    const fullText = card.textContent || '';

    // Extract solution word
    const solutionMatch = fullText.match(/solution was:\s*([a-z]{5})/i);
    if (solutionMatch && solutionMatch[1]) {
      game.solution = solutionMatch[1].toUpperCase();
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
    const skillMatch = fullText.match(/Your score was:\s*(\d{1,3})/i);
    if (skillMatch && skillMatch[1]) {
      game.skillScore = parseInt(skillMatch[1], 10);
    }

    // Extract luck score
    const luckMatch = fullText.match(/Your luck was:\s*(\d{1,3})/i);
    if (luckMatch && luckMatch[1]) {
      game.luckScore = parseInt(luckMatch[1], 10);
    }

    // Extract steps
    const stepsMatch = fullText.match(/It took you:\s*(\d+)/i);
    if (stepsMatch && stepsMatch[1]) {
      game.steps = parseInt(stepsMatch[1], 10);
      game.won = true;
    }

    // Get analysis link
    const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
    if (link && !link.getAttribute('href')?.includes('index.html')) {
      game.analysisUrl = (link as HTMLAnchorElement).href;
    }

    return game;
  }

  private async loadMoreGames(): Promise<boolean> {
    // Try multiple selectors for the button
    let btn = document.querySelector(this.SHOW_MORE_BUTTON_SELECTOR) as HTMLElement;
    
    // If not found, try alternative selectors
    if (!btn) {
      const alternatives = [
        '.show-more-button',
        '[class*="show-more"]',
        'button[class*="show"]'
      ];
      
      for (const selector of alternatives) {
        btn = document.querySelector(selector) as HTMLElement;
        if (btn) break;
      }
    }
    
    // Check if button exists and is visible
    if (!btn) {
      console.log('[WordleBotScraper] Load more button not found');
      return false;
    }
    
    // Check if button is hidden (display: none or visibility: hidden)
    const style = window.getComputedStyle(btn);
    if (style.display === 'none' || style.visibility === 'hidden') {
      console.log('[WordleBotScraper] Load more button is hidden');
      return false;
    }

    const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
    console.log(`[WordleBotScraper] Clicking load more button. Current cards: ${beforeCount}`);
    btn.click();
    
    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const afterCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
    const newCards = afterCount - beforeCount;
    
    console.log(`[WordleBotScraper] After load more: ${afterCount} cards (${newCards} new)`);
    
    return newCards > 0;
  }

  private async processAndSendGames(rawGames: RawGameData[]): Promise<void> {
    console.log(`[WordleBotScraper] Processing ${rawGames.length} games`);
    this.sendProgress(rawGames.length, 0, 'Processing games...');
    
    // Sort by game number (newest first)
    const sortedGames = rawGames.sort((a, b) => {
      const aNum = a.gameNumber || 0;
      const bNum = b.gameNumber || 0;
      return bNum - aNum;
    });

    // Convert to GameResult format
    const gameResults: GameResult[] = sortedGames.map(raw => this.convertToGameResult(raw));

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

  private convertToGameResult(raw: RawGameData): GameResult {
    const now = new Date();
    const dateString = raw.date ?? now.toISOString().split('T')[0];
    const date: string = dateString!; // Safe because split always returns string
    
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
      scrapedFrom: 'wordle-bot' as const,
      source: 'wordle-page' as const,
      importedAt: now.toISOString(),
      wordLength: 5,
      maxGuesses: 6
    };
  }

  private sendProgress(
    gamesFound: number,
    gamesProcessed: number,
    status: string
  ): void {
    const message: WordleBotScrapeProgressMessage = {
      type: MessageType.WORDLE_BOT_SCRAPE_PROGRESS,
      gamesFound,
      gamesProcessed,
      duplicatesSkipped: this.duplicatesSkipped,
      status
    };

    chrome.runtime.sendMessage(message).catch(error => {
      console.error('[WordleBotScraper] Error sending progress:', error);
    });
  }

  private sendComplete(
    imported: number,
    duplicates: number,
    errors: number,
    games: RawGameData[]
  ): void {
    const message: WordleBotScrapeCompleteMessage = {
      type: MessageType.WORDLE_BOT_SCRAPE_COMPLETE,
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

  private sendError(error: string, code: 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN', recoverable: boolean): void {
    const message: WordleBotScrapeErrorMessage = {
      type: MessageType.WORDLE_BOT_SCRAPE_ERROR,
      error,
      code,
      recoverable
    };

    chrome.runtime.sendMessage(message).catch(err => {
      console.error('[WordleBotScraper] Error sending error message:', err);
    });
  }
}

// Initialize scraper
const scraper = new WordleBotScraper();

// Auto-start if in background mode
if (!document.hasFocus()) {
  console.log('[WordleBotScraper] Background mode detected, auto-starting');
  // Will be triggered by message from background script
}

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).__wordleBotScraper = scraper;
}
