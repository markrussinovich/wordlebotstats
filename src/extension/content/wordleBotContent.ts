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
  boardImageUrl?: string;
}

class WordleBotScraper {
  private isRunning = false;
  private shouldStop = false;
  private gamesProcessed = 0;
  private duplicatesSkipped = 0;

  // Confirmed selectors from v5
  private readonly GAME_CARD_SELECTOR = '.rating-container:not(.label-container)';
  private readonly SHOW_MORE_BUTTON_SELECTOR = '[class*="show-more-button"]';
  private loadMoreNoGrowthAttempts = 0;
  
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
  this.loadMoreNoGrowthAttempts = 0;

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

    // Extract solution word from <strong class="solution">
    const solutionEl = card.querySelector('strong.solution');
    if (solutionEl) {
      game.solution = solutionEl.textContent?.trim().toUpperCase();
      console.log('[WordleBotScraper] Found solution:', game.solution);
    }

    // Extract date from <span class="date-label">
    const dateEl = card.querySelector('span.date-label');
    if (dateEl) {
      const dateText = dateEl.textContent?.trim() || '';
      game.dateString = dateText;
      
      const dateMatch = dateText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
      if (dateMatch && dateMatch[1] && dateMatch[2]) {
        const monthName = dateMatch[1];
        const day = parseInt(dateMatch[2], 10);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();

        // Convert month name to month index (0-11)
        const monthIndex = new Date(`${monthName} 1, ${currentYear}`).getMonth();

        // Build the date in UTC so we don't lose a day when converting to ISO string
        const currentDateUtc = Date.UTC(currentYear, currentDate.getMonth(), currentDate.getDate());
        let candidateUtc = Date.UTC(currentYear, monthIndex, day);

        // If the candidate date is in the future, assume it belongs to the previous year
        if (candidateUtc > currentDateUtc) {
          candidateUtc = Date.UTC(currentYear - 1, monthIndex, day);
        }

        const isoDate = new Date(candidateUtc).toISOString().split('T')[0];
        if (isoDate) {
          game.date = isoDate;
          console.log('[WordleBotScraper] Found date:', game.date, 'from', game.dateString);
        }
      }
    }

    // Extract skill, luck, and steps from <div class="rating-value num"> elements
    // The HTML has rating-right section with three rating-value num divs in order: skill, luck, steps
    const ratingRight = card.querySelector('.rating-right');
    if (ratingRight) {
      const numValues = ratingRight.querySelectorAll('.rating-value.num span.num');
      
      if (numValues.length >= 2 && numValues[0] && numValues[1]) {
        // First is skill
        game.skillScore = parseInt(numValues[0].textContent?.trim() || '0', 10);
        console.log('[WordleBotScraper] Found skill:', game.skillScore);
        
        // Second is luck  
        game.luckScore = parseInt(numValues[1].textContent?.trim() || '0', 10);
        console.log('[WordleBotScraper] Found luck:', game.luckScore);
        
        // Third is steps (if exists)
        if (numValues.length >= 3 && numValues[2]) {
          const stepsText = numValues[2].textContent?.trim() || '';
          // Check if it's a dash (lost game)
          if (stepsText === '-' || stepsText === '—' || stepsText === '–' || stepsText === '') {
            game.won = false;
            game.steps = 7; // Represent failed games with 7 attempts (Wordle convention)
            console.log('[WordleBotScraper] Lost game (dash or empty detected)');
          } else {
            const parsedSteps = parseInt(stepsText, 10);
            if (isNaN(parsedSteps) || parsedSteps === 0) {
              game.won = false;
              game.steps = 7;
              console.log('[WordleBotScraper] Lost game (invalid steps)');
            } else {
              game.steps = parsedSteps;
              game.won = true;
              console.log('[WordleBotScraper] Found steps:', game.steps);
            }
          }
        } else {
          // No steps data available - check if we can infer from other data
          // If skill and luck exist but no steps, it's likely a lost game
          if (game.skillScore !== undefined && game.luckScore !== undefined) {
            game.won = false;
            game.steps = 7;
            console.log('[WordleBotScraper] Lost game (no steps data)');
          }
        }
      }
    }

    // Extract board image - the wordle-board div contains the game grid
    const boardEl = card.querySelector('.wordle-board, .micro');
    if (boardEl) {
      // Try to convert the board HTML to a data URL or just store a reference
      // For now, we'll capture the outerHTML as a data structure
      // In a real implementation, you might want to render this or take a screenshot
      console.log('[WordleBotScraper] Found board element');
      // We could serialize this to an image, but for now just note that we found it
      // game.boardImageUrl = ... (would need canvas rendering)
    }
    
    // Also check for actual image elements
    const boardImage = card.querySelector('img[src]');
    if (boardImage) {
      game.boardImageUrl = (boardImage as HTMLImageElement).src;
      console.log('[WordleBotScraper] Found board image:', game.boardImageUrl);
    }

    // Get analysis link
    const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
    if (link && !link.getAttribute('href')?.includes('index.html')) {
      game.analysisUrl = (link as HTMLAnchorElement).href;
    }

    return game;
  }

  private async loadMoreGames(): Promise<boolean> {
    const button = this.findShowMoreButton();
    if (!button) {
      console.log('[WordleBotScraper] Load more button not found');
      return false;
    }

    const style = window.getComputedStyle(button);
    const isHidden = style.display === 'none' || style.visibility === 'hidden';
    const isDisabled = button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';
    if (isHidden || isDisabled) {
      console.log('[WordleBotScraper] Load more button unavailable (hidden or disabled)');
      return false;
    }

    const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
    console.log(`[WordleBotScraper] Clicking load more button. Current cards: ${beforeCount}`);

    try {
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      console.warn('[WordleBotScraper] Failed to scroll load more button into view:', error);
    }

    (button as HTMLElement).click();

    // Wait for new content to render
    await new Promise(resolve => setTimeout(resolve, 2500));

    const afterCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
    const newCards = afterCount - beforeCount;
    console.log(`[WordleBotScraper] After load more: ${afterCount} cards (${newCards} new)`);

    if (newCards > 0) {
      this.loadMoreNoGrowthAttempts = 0;
      return true;
    }

    this.loadMoreNoGrowthAttempts += 1;
    const stillHasButton = !!this.findShowMoreButton();

    if (stillHasButton && this.loadMoreNoGrowthAttempts < 3) {
      console.log('[WordleBotScraper] No new cards detected yet; retrying while button remains visible.');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    }

    console.log('[WordleBotScraper] No additional cards after multiple attempts, stopping pagination.');
    return false;
  }

  private findShowMoreButton(): HTMLElement | null {
    const selectors = [
      this.SHOW_MORE_BUTTON_SELECTOR,
      '.show-more-button',
      '.show-more-container button',
      'button[class*="show-more"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element) {
        return element;
      }
    }

    const candidates = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]'));
    for (const candidate of candidates) {
      const text = candidate.textContent?.toLowerCase().trim();
      if (!text) continue;
      if (text.includes('show more') && text.includes('wordle')) {
        return candidate as HTMLElement;
      }
    }

    return null;
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
    
    // Determine won status: use raw.won if explicitly set, otherwise infer from steps
    const attempts = raw.steps ?? 0;
    const won = raw.won !== undefined ? raw.won : (attempts > 0 && attempts <= 6);
    
    return {
      date,
      ...(raw.gameNumber && { gameNumber: raw.gameNumber }),
      won,
      attempts: attempts > 0 ? attempts : null,
      hardMode: false, // WordleBot doesn't track this
      ...(raw.solution && { solution: raw.solution }),
      ...(raw.skillScore !== undefined && { skillScore: raw.skillScore }),
      ...(raw.luckScore !== undefined && { luckScore: raw.luckScore }),
      ...(raw.boardImageUrl && { boardImageUrl: raw.boardImageUrl }),
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
