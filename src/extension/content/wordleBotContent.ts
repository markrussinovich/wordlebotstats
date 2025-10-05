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
    maxIterations: number = 20
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

    try {
      await this.scrapeAllGames(stopAtDate, maxIterations);
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

  private async scrapeAllGames(
    stopAtDate?: string,
    maxIterations: number = 20
  ): Promise<void> {
    const allGames = new Map<string, RawGameData>();
    let iteration = 0;

    while (iteration < maxIterations && !this.shouldStop) {
      iteration++;
      
      // Extract games from current page
      const games = this.extractVisibleGames();
      console.log(`[WordleBotScraper] Iteration ${iteration}: Found ${games.length} games`);

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
    const btn = document.querySelector(this.SHOW_MORE_BUTTON_SELECTOR) as HTMLElement;
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

  private async processAndSendGames(rawGames: RawGameData[]): Promise<void> {
    console.log(`[WordleBotScraper] Processing ${rawGames.length} games`);
    
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
    status: 'scanning' | 'loading' | 'processing'
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
