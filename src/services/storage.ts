// Storage service with IndexedDB + Extension Storage integration
import { GameResult, UserPreferences } from '@/types/gameTypes';
import { BenchmarkData } from '@/types/benchmarkTypes';

export interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
}

export interface BackupData {
  version: string;
  timestamp: string;
  games: GameResult[];
  preferences: UserPreferences;
  benchmarks: BenchmarkData[];
}

export interface StorageStats {
  totalGames: number;
  oldestGame: string | null;
  newestGame: string | null;
  storageSize: number;
  lastSync: string | null;
}

export class StorageService {
  private static instance: StorageService;
  private dbName = 'wordleStatsDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Initialize storage
  async initialize(): Promise<void> {
    try {
      await this.initIndexedDB();
      await this.ensureExtensionStorage();
    } catch (error) {
      console.error('Storage initialization failed:', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create games store
        if (!db.objectStoreNames.contains('games')) {
          const gamesStore = db.createObjectStore('games', { keyPath: 'date' });
          gamesStore.createIndex('dateIndex', 'date', { unique: true });
          gamesStore.createIndex('wonIndex', 'won');
          gamesStore.createIndex('sourceIndex', 'source');
        }
        
        // Create benchmarks store
        if (!db.objectStoreNames.contains('benchmarks')) {
          const benchmarksStore = db.createObjectStore('benchmarks', { keyPath: 'source' });
          benchmarksStore.createIndex('sourceIndex', 'source', { unique: true });
        }
        
        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureExtensionStorage(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // Verify extension storage is available
      try {
        await chrome.storage.local.get('test');
        await chrome.storage.sync.get('test');
      } catch (error) {
        throw new Error('Extension storage not available');
      }
    }
  }

  // Game data operations
  async saveGame(game: GameResult): Promise<void> {
    try {
      // Save to IndexedDB
      await this.saveToIndexedDB('games', game);
      
      // Update extension storage cache (last 30 games for quick access)
      await this.updateExtensionCache();
      
    } catch (error) {
      console.error('Failed to save game:', error);
      throw new Error(`Failed to save game: ${error}`);
    }
  }

  async saveGames(games: GameResult[]): Promise<void> {
    try {
      // Batch save to IndexedDB
      await this.batchSaveToIndexedDB('games', games);
      
      // Update extension cache
      await this.updateExtensionCache();
      
    } catch (error) {
      console.error('Failed to save games:', error);
      throw new Error(`Failed to save games: ${error}`);
    }
  }

  async bulkImportGames(games: GameResult[]): Promise<{
    imported: number;
    duplicates: number;
    errors: number;
  }> {
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      for (const game of games) {
        try {
          const existing = await this.getGame(game.date);
          
          if (existing) {
            // Check if new game has more data (skill/luck scores from WordleBot)
            const shouldReplace = this.shouldReplaceExisting(existing, game);
            
            if (shouldReplace) {
              await this.saveGame(game);
              imported++;
            } else {
              duplicates++;
            }
          } else {
            await this.saveGame(game);
            imported++;
          }
        } catch (error) {
          console.error('Failed to import game:', game.date, error);
          errors++;
        }
      }

      // Update cache after bulk import
      await this.updateExtensionCache();
      
      // Update metadata
      await this.setMetadata('lastBulkImport', {
        timestamp: new Date().toISOString(),
        imported,
        duplicates,
        errors
      });
      
    } catch (error) {
      console.error('Failed to bulk import games:', error);
      throw new Error(`Failed to bulk import games: ${error}`);
    }

    return { imported, duplicates, errors };
  }

  private shouldReplaceExisting(existing: GameResult, newGame: GameResult): boolean {
    // Prefer games with more data (WordleBot data is richer)
    const existingScore = this.getDataRichnessScore(existing);
    const newScore = this.getDataRichnessScore(newGame);
    
    return newScore > existingScore;
  }

  private getDataRichnessScore(game: GameResult): number {
    let score = 0;
    
    // Base score for having the game
    score += 1;
    
    // Extra points for additional fields
    if (game.skillScore !== undefined) score += 2;
    if (game.luckScore !== undefined) score += 2;
    if (game.analysisUrl) score += 1;
    if (game.solution) score += 1;
    if (game.guessPattern && game.guessPattern.length > 0) score += 2;
    if (game.duration || game.timeToComplete) score += 1;
    
    return score;
  }

  async getNewestGame(): Promise<GameResult | null> {
    try {
      const games = await this.getAllGames();
      if (games.length === 0) return null;
      
      return games.reduce((newest, game) => {
        return new Date(game.date) > new Date(newest.date) ? game : newest;
      });
    } catch (error) {
      console.error('Failed to get newest game:', error);
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
      const metadata = await this.getMetadata('wordleBotScraper');
      
      return {
        lastScrape: metadata?.value?.lastScrape || null,
        lastScrapeMode: metadata?.value?.lastScrapeMode || null,
        totalScraped: metadata?.value?.totalScraped || 0,
        lastError: metadata?.value?.lastError || null
      };
    } catch (error) {
      console.error('Failed to get scraper metadata:', error);
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
      const currentMetadata = await this.getScraperMetadata();
      
      const newMetadata = {
        lastScrape: update.lastScrape || currentMetadata.lastScrape,
        lastScrapeMode: update.lastScrapeMode || currentMetadata.lastScrapeMode,
        totalScraped: update.totalScraped !== undefined ? update.totalScraped : currentMetadata.totalScraped,
        lastError: update.lastError !== undefined ? update.lastError : currentMetadata.lastError
      };
      
      await this.setMetadata('wordleBotScraper', newMetadata);
    } catch (error) {
      console.error('Failed to update scraper metadata:', error);
    }
  }

  async getGame(date: string): Promise<GameResult | null> {
    try {
      return await this.getFromIndexedDB('games', date);
    } catch (error) {
      console.error('Failed to get game:', error);
      return null;
    }
  }

  async getAllGames(): Promise<GameResult[]> {
    try {
      return await this.getAllFromIndexedDB('games');
    } catch (error) {
      console.error('Failed to get all games:', error);
      return [];
    }
  }

  async getGamesInRange(startDate: string, endDate: string): Promise<GameResult[]> {
    try {
      return await this.getFromIndexedDBRange('games', 'dateIndex', startDate, endDate);
    } catch (error) {
      console.error('Failed to get games in range:', error);
      return [];
    }
  }

  async deleteGame(date: string): Promise<void> {
    try {
      await this.deleteFromIndexedDB('games', date);
      await this.updateExtensionCache();
    } catch (error) {
      console.error('Failed to delete game:', error);
      throw new Error(`Failed to delete game: ${error}`);
    }
  }

  async deleteAllGames(): Promise<void> {
    try {
      await this.clearIndexedDBStore('games');
      await this.clearExtensionStorage(['games', 'gamesCache']);
    } catch (error) {
      console.error('Failed to delete all games:', error);
      throw new Error(`Failed to delete all games: ${error}`);
    }
  }

  // Preferences operations (using Extension Storage for sync)
  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.set({ preferences });
      } else {
        // Fallback to localStorage
        localStorage.setItem('wordle-preferences', JSON.stringify(preferences));
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw new Error(`Failed to save preferences: ${error}`);
    }
  }

  async getPreferences(): Promise<UserPreferences | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.sync.get('preferences');
        return result.preferences || null;
      } else {
        // Fallback to localStorage
        const data = localStorage.getItem('wordle-preferences');
        return data ? JSON.parse(data) : null;
      }
    } catch (error) {
      console.error('Failed to get preferences:', error);
      return null;
    }
  }

  // Benchmark data operations
  async saveBenchmark(benchmark: BenchmarkData): Promise<void> {
    try {
      await this.saveToIndexedDB('benchmarks', benchmark);
    } catch (error) {
      console.error('Failed to save benchmark:', error);
      throw new Error(`Failed to save benchmark: ${error}`);
    }
  }

  async getBenchmark(source: string): Promise<BenchmarkData | null> {
    try {
      return await this.getFromIndexedDB('benchmarks', source);
    } catch (error) {
      console.error('Failed to get benchmark:', error);
      return null;
    }
  }

  async getAllBenchmarks(): Promise<BenchmarkData[]> {
    try {
      return await this.getAllFromIndexedDB('benchmarks');
    } catch (error) {
      console.error('Failed to get all benchmarks:', error);
      return [];
    }
  }

  // Storage management
  async getStorageStats(): Promise<StorageStats> {
    try {
      const games = await this.getAllGames();
      const sortedGames = games.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const quota = await this.getStorageQuota();
      const lastSyncData = await this.getMetadata('lastSync');

      return {
        totalGames: games.length,
        oldestGame: sortedGames.length > 0 ? sortedGames[0]?.date ?? null : null,
        newestGame: sortedGames.length > 0 ? sortedGames[sortedGames.length - 1]?.date ?? null : null,
        storageSize: quota.used,
        lastSync: lastSyncData?.value || null
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }

  async getStorageQuota(): Promise<StorageQuota> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const available = estimate.quota || 0;
        const percentage = available > 0 ? (used / available) * 100 : 0;

        return { used, available, percentage };
      }

      // Fallback estimation
      return { used: 0, available: 50 * 1024 * 1024, percentage: 0 };
    } catch (error) {
      console.error('Failed to get storage quota:', error);
      return { used: 0, available: 50 * 1024 * 1024, percentage: 0 };
    }
  }

  async cleanupOldData(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0]!;

      const oldGames = await this.getFromIndexedDBRange(
        'games', 
        'dateIndex', 
        '1900-01-01', 
        cutoffDateString
      );

      for (const game of oldGames) {
        await this.deleteFromIndexedDB('games', game.date);
      }

      await this.updateExtensionCache();
      return oldGames.length;
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
      return 0;
    }
  }

  // Backup and restore
  async createBackup(): Promise<BackupData> {
    try {
      const games = await this.getAllGames();
      const preferences = await this.getPreferences();
      const benchmarks = await this.getAllBenchmarks();

      return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        games,
        preferences: preferences || {} as UserPreferences,
        benchmarks
      };
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  async restoreFromBackup(backupData: BackupData): Promise<void> {
    try {
      // Validate backup format
      if (!backupData.version || !backupData.games) {
        throw new Error('Invalid backup format');
      }

      // Clear existing data
      await this.deleteAllGames();
      
      // Restore games
      if (backupData.games.length > 0) {
        await this.saveGames(backupData.games);
      }

      // Restore preferences
      if (backupData.preferences) {
        await this.savePreferences(backupData.preferences);
      }

      // Restore benchmarks
      if (backupData.benchmarks && backupData.benchmarks.length > 0) {
        for (const benchmark of backupData.benchmarks) {
          await this.saveBenchmark(benchmark);
        }
      }

      await this.setMetadata('lastRestore', new Date().toISOString());
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw new Error(`Failed to restore from backup: ${error}`);
    }
  }

  // Metadata operations
  async setMetadata(key: string, value: any): Promise<void> {
    try {
      await this.saveToIndexedDB('metadata', { key, value, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to set metadata:', error);
    }
  }

  async getMetadata(key: string): Promise<{ value: any; timestamp: string } | null> {
    try {
      return await this.getFromIndexedDB('metadata', key);
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return null;
    }
  }

  // Private IndexedDB helpers
  private async saveToIndexedDB(storeName: string, data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save to IndexedDB'));
    });
  }

  private async batchSaveToIndexedDB(storeName: string, dataArray: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      let completed = 0;
      let hasError = false;

      const onComplete = () => {
        completed++;
        if (completed === dataArray.length && !hasError) {
          resolve();
        }
      };

      const onError = () => {
        if (!hasError) {
          hasError = true;
          reject(new Error('Failed to batch save to IndexedDB'));
        }
      };

      dataArray.forEach(data => {
        const request = store.put(data);
        request.onsuccess = onComplete;
        request.onerror = onError;
      });
    });
  }

  private async getFromIndexedDB(storeName: string, key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get from IndexedDB'));
    });
  }

  private async getAllFromIndexedDB(storeName: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get all from IndexedDB'));
    });
  }

  private async getFromIndexedDBRange(
    storeName: string, 
    indexName: string, 
    startKey: string, 
    endKey: string
  ): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const range = IDBKeyRange.bound(startKey, endKey);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get range from IndexedDB'));
    });
  }

  private async deleteFromIndexedDB(storeName: string, key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete from IndexedDB'));
    });
  }

  private async clearIndexedDBStore(storeName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear IndexedDB store'));
    });
  }

  // Extension storage helpers
  private async updateExtensionCache(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      // Cache last 30 games for quick popup access
      const recentGames = await this.getRecentGames(30);
      await chrome.storage.local.set({ 
        gamesCache: recentGames,
        lastCacheUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to update extension cache:', error);
    }
  }

  private async getRecentGames(count: number): Promise<GameResult[]> {
    const allGames = await this.getAllGames();
    return allGames
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, count);
  }

  private async clearExtensionStorage(keys: string[]): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      await chrome.storage.local.remove(keys);
    } catch (error) {
      console.error('Failed to clear extension storage:', error);
    }
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();