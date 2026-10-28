// Simple storage service for Manifest V3 service workers
// Uses only chrome.storage API (no IndexedDB which isn't available in service workers)

import { GameResult } from '@/types/gameTypes';
import { mergeGames } from '@/utils/mergeGames';
import logger from '../utils/logger';
const log = logger.log; const errorLog = logger.error;

export class ExtensionStorage {
  private static instance: ExtensionStorage;
  private writeQueue: Promise<unknown> = Promise.resolve();

  private constructor() {}

  public static getInstance(): ExtensionStorage {
    if (!ExtensionStorage.instance) {
      ExtensionStorage.instance = new ExtensionStorage();
    }
    return ExtensionStorage.instance;
  }

  async initialize(): Promise<void> {
    // No initialization needed for chrome.storage
  log('[ExtensionStorage] Initialized');
  }

  async getAllGames(): Promise<GameResult[]> {
    try {
      const result = await chrome.storage.local.get('games');
      return result.games || [];
    } catch (error) {
  errorLog('[ExtensionStorage] Failed to get games:', error);
      throw error;
    }
  }

  async saveGame(game: GameResult): Promise<void> {
    const result = await this.bulkImportGames([game]);
    if (result.errors) throw new Error('Game could not be saved');
  }

  async bulkImportGames(newGames: GameResult[]): Promise<{
    imported: number;
    duplicates: number;
    errors: number;
  }> {
    const operation = this.writeQueue.then(() => this.importGames(newGames));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  private async importGames(newGames: GameResult[]): Promise<{
    imported: number;
    duplicates: number;
    errors: number;
  }> {
  log(`[ExtensionStorage] =====> bulkImportGames called with ${newGames.length} games`);
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    try {
  log(`[ExtensionStorage] =====> Reading existing games...`);
      const startRead = performance.now();
      const existingGames = await this.getAllGames();
  log(`[ExtensionStorage] =====> Read ${existingGames.length} existing games in ${(performance.now() - startRead).toFixed(0)}ms`);
      
      const gameMap = new Map<string, GameResult>();
      
      // Add existing games to map
      existingGames.forEach(game => {
        gameMap.set(game.date, game);
      });
      
  log(`[ExtensionStorage] =====> Processing ${newGames.length} new games...`);
      // Process new games
      for (const game of newGames) {
        try {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date) || !Number.isFinite(Date.parse(game.date)) ||
              new Date(game.date).toISOString().slice(0, 10) !== game.date) {
            throw new Error('Invalid game date');
          }
          const existing = gameMap.get(game.date);
          
          if (existing) {
            const merged = mergeGames(existing, game);
            const meaningful = (value: GameResult) => JSON.stringify({
              ...value, importedAt: undefined, boardImageUrl: undefined
            });
            const shouldReplace = meaningful(merged) !== meaningful(existing);
            
            if (shouldReplace) {
              gameMap.set(game.date, merged);
              imported++;
            } else {
              duplicates++;
            }
          } else {
            gameMap.set(game.date, game);
            imported++;
          }
        } catch (error) {
          errorLog('[ExtensionStorage] Failed to process game:', game.date, error);
          errors++;
        }
      }
      
      // Save all games
  log(`[ExtensionStorage] =====> Writing ${gameMap.size} total games to storage...`);
      const startWrite = performance.now();
      const allGames = Array.from(gameMap.values());
      
      // OPTIMIZATION: Remove board images before storage to speed up writes
      // Board images are large base64 strings that slow down chrome.storage.local.set
  log(`[ExtensionStorage] =====> Stripping board images from ${allGames.length} games...`);
      const lightweightGames = allGames.map(g => ({
        ...g,
        boardImageUrl: undefined  // Strip large base64 data URLs
      }));
      
  log(`[ExtensionStorage] =====> Calling chrome.storage.local.set...`);
      await chrome.storage.local.set({ games: lightweightGames });
  log(`[ExtensionStorage] =====> Write completed in ${(performance.now() - startWrite).toFixed(0)}ms`);
      
    } catch (error) {
      console.error('[ExtensionStorage] Bulk import failed:', error);
      throw error;
    }

  log(`[ExtensionStorage] =====> bulkImportGames complete: imported=${imported}, duplicates=${duplicates}, errors=${errors}`);
    return { imported, duplicates, errors };
  }

  async getNewestGame(): Promise<GameResult | null> {
    try {
      const games = await this.getAllGames();
      if (games.length === 0) return null;
      
      return games.reduce((newest, game) => {
        return new Date(game.date) > new Date(newest.date) ? game : newest;
      });
    } catch (error) {
      console.error('[ExtensionStorage] Failed to get newest game:', error);
      return null;
    }
  }

  async getScraperMetadata(): Promise<{
    lastScrape: string | null;
    lastScrapeMode: 'full' | 'incremental' | 'auto' | null;
    totalScraped: number;
    lastError: string | null;
  }> {
    try {
      const result = await chrome.storage.local.get('scraperMetadata');
      const metadata = result.scraperMetadata || {};
      
      return {
        lastScrape: metadata.lastScrape || null,
        lastScrapeMode: metadata.lastScrapeMode || null,
        totalScraped: metadata.totalScraped || 0,
        lastError: metadata.lastError || null
      };
    } catch (error) {
      console.error('[ExtensionStorage] Failed to get scraper metadata:', error);
      return {
        lastScrape: null,
        lastScrapeMode: null,
        totalScraped: 0,
        lastError: null
      };
    }
  }

  async updateScraperMetadata(update: {
    lastScrape?: string;
    lastScrapeMode?: 'full' | 'incremental' | 'auto';
    totalScraped?: number;
    lastError?: string;
  }): Promise<void> {
    try {
      const current = await this.getScraperMetadata();
      
      const newMetadata = {
        lastScrape: update.lastScrape || current.lastScrape,
        lastScrapeMode: update.lastScrapeMode || current.lastScrapeMode,
        totalScraped: update.totalScraped !== undefined ? update.totalScraped : current.totalScraped,
        lastError: update.lastError !== undefined ? update.lastError : current.lastError
      };
      
      await chrome.storage.local.set({ scraperMetadata: newMetadata });
    } catch (error) {
      console.error('[ExtensionStorage] Failed to update scraper metadata:', error);
    }
  }

  async getPreferences(): Promise<any | null> {
    try {
      const result = await chrome.storage.sync.get('preferences');
      return result.preferences || null;
    } catch (error) {
      console.error('[ExtensionStorage] Failed to get preferences:', error);
      return null;
    }
  }
}
