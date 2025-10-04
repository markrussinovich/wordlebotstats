// Data import service with Wordle page parsing and external data sources
import { GameResult } from '@/types/gameTypes';
import GameResultModel from '@/models/GameResult';

export interface ImportSource {
  id: string;
  name: string;
  description: string;
  supported: boolean;
  requiresAuth?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  games: GameResult[];
}

export interface ParsedWordleGame {
  date: string;
  won: boolean;
  guesses: number;
  solution?: string;
  gameNumber?: number;
  shareText?: string;
}

export class DataImportService {
  private static instance: DataImportService;
  
  // Supported import sources
  private readonly supportedSources: ImportSource[] = [
    {
      id: 'wordle-nyt',
      name: 'Wordle (NYT)',
      description: 'Import from New York Times Wordle page',
      supported: true
    },
    {
      id: 'wordle-share',
      name: 'Share Text',
      description: 'Import from Wordle share text (emoji squares)',
      supported: true
    },
    {
      id: 'csv-file',
      name: 'CSV File',
      description: 'Import from CSV file export',
      supported: true
    },
    {
      id: 'json-file',
      name: 'JSON File',
      description: 'Import from JSON file export',
      supported: true
    },
    {
      id: 'wordle-archive',
      name: 'Wordle Archive',
      description: 'Import from archived Wordle games',
      supported: false
    },
    {
      id: 'nyt-games',
      name: 'NYT Games',
      description: 'Import from NYT Games account',
      supported: false,
      requiresAuth: true
    }
  ];

  private constructor() {}

  public static getInstance(): DataImportService {
    if (!DataImportService.instance) {
      DataImportService.instance = new DataImportService();
    }
    return DataImportService.instance;
  }

  // Get available import sources
  getSupportedSources(): ImportSource[] {
    return this.supportedSources.filter(source => source.supported);
  }

  getAllSources(): ImportSource[] {
    return [...this.supportedSources];
  }

  // Parse Wordle page data
  async parseWordlePage(): Promise<ParsedWordleGame[]> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Page parsing only available in browser context');
    }

    try {
      const games: ParsedWordleGame[] = [];
      
      // Try to get data from localStorage (NYT Wordle stores game state here)
      const localStorageGames = this.parseLocalStorageData();
      games.push(...localStorageGames);

      // Try to parse from page DOM
      const domGames = this.parseDOMData();
      games.push(...domGames);

      // Deduplicate by date
      const uniqueGames = this.deduplicateGames(games);

      return uniqueGames;

    } catch (error) {
      console.error('Failed to parse Wordle page:', error);
      throw new Error(`Page parsing failed: ${error}`);
    }
  }

  // Parse localStorage data (NYT Wordle)
  private parseLocalStorageData(): ParsedWordleGame[] {
    const games: ParsedWordleGame[] = [];

    try {
      // NYT Wordle stores game statistics in localStorage
      const gameStatsKey = 'nyt-wordle-statistics';
      const gameStateKey = 'nyt-wordle-state';
      
      const statsData = localStorage.getItem(gameStatsKey);
      const stateData = localStorage.getItem(gameStateKey);

      if (statsData) {
        const stats = JSON.parse(statsData);
        
        // Extract individual game results if available
        if (stats.gamesFailed && Array.isArray(stats.gamesFailed)) {
          stats.gamesFailed.forEach((gameNumber: number) => {
            games.push({
              date: this.gameNumberToDate(gameNumber),
              won: false,
              guesses: 0,
              gameNumber
            });
          });
        }

        if (stats.gamesWon && Array.isArray(stats.gamesWon)) {
          stats.gamesWon.forEach((result: any) => {
            games.push({
              date: this.gameNumberToDate(result.gameNumber || 0),
              won: true,
              guesses: result.guesses || 0,
              gameNumber: result.gameNumber
            });
          });
        }
      }

      // Parse current game state
      if (stateData) {
        const state = JSON.parse(stateData);
        if (state.gameStatus === 'WIN' || state.gameStatus === 'FAIL') {
          games.push({
            date: new Date().toISOString().split('T')[0],
            won: state.gameStatus === 'WIN',
            guesses: state.rowIndex || 0,
            solution: state.solution,
            gameNumber: state.gameNumber
          });
        }
      }

    } catch (error) {
      console.error('Error parsing localStorage data:', error);
    }

    return games;
  }

  // Parse DOM data
  private parseDOMData(): ParsedWordleGame[] {
    const games: ParsedWordleGame[] = [];

    try {
      // Look for completed game indicators
      const gameBoard = document.querySelector('[data-testid="board"]') ||
                       document.querySelector('.Board-module_board');

      if (gameBoard) {
        const gameData = this.extractGameFromBoard(gameBoard);
        if (gameData) {
          games.push(gameData);
        }
      }

      // Look for share button (indicates completed game)
      const shareButton = document.querySelector('[data-testid="share-button"]');
      if (shareButton) {
        const shareData = this.extractGameFromShareButton();
        if (shareData) {
          games.push(shareData);
        }
      }

    } catch (error) {
      console.error('Error parsing DOM data:', error);
    }

    return games;
  }

  private extractGameFromBoard(gameBoard: Element): ParsedWordleGame | null {
    try {
      const rows = gameBoard.querySelectorAll('[data-testid^="row"]');
      if (rows.length === 0) return null;

      let guesses = 0;
      let won = false;
      let gameComplete = false;

      Array.from(rows).forEach((row, index) => {
        const tiles = row.querySelectorAll('[data-testid^="tile"]');
        if (tiles.length === 0) return;

        const rowHasContent = Array.from(tiles).some(tile => 
          tile.textContent?.trim()
        );

        if (rowHasContent) {
          guesses++;

          const allCorrect = Array.from(tiles).every(tile => {
            const state = tile.getAttribute('data-state');
            return state === 'correct';
          });

          if (allCorrect) {
            won = true;
            gameComplete = true;
          } else if (index === rows.length - 1) {
            gameComplete = true;
          }
        }
      });

      if (!gameComplete) return null;

      return {
        date: new Date().toISOString().split('T')[0],
        won,
        guesses: won ? guesses : 0
      };

    } catch (error) {
      console.error('Error extracting game from board:', error);
      return null;
    }
  }

  private extractGameFromShareButton(): ParsedWordleGame | null {
    try {
      // This would require accessing the share functionality
      // For now, return null as share text parsing is handled separately
      return null;
    } catch (error) {
      console.error('Error extracting game from share button:', error);
      return null;
    }
  }

  // Parse Wordle share text
  parseShareText(shareText: string): ParsedWordleGame[] {
    const games: ParsedWordleGame[] = [];

    try {
      // Split by games (each game starts with "Wordle")
      const gameBlocks = shareText.split(/Wordle\s+/i).filter(block => block.trim());

      gameBlocks.forEach(block => {
        const game = this.parseShareGameBlock(block);
        if (game) {
          games.push(game);
        }
      });

    } catch (error) {
      console.error('Error parsing share text:', error);
      throw new Error(`Share text parsing failed: ${error}`);
    }

    return games;
  }

  private parseShareGameBlock(block: string): ParsedWordleGame | null {
    try {
      const lines = block.trim().split('\n');
      if (lines.length < 2) return null;

      // First line should contain game info: "123 4/6" or "123 X/6"
      const gameInfoMatch = lines[0].match(/(\d+)\s+([X\d])\/(\d+)/);
      if (!gameInfoMatch) return null;

      const gameNumber = parseInt(gameInfoMatch[1], 10);
      const result = gameInfoMatch[2];
      const maxGuesses = parseInt(gameInfoMatch[3], 10);

      const won = result !== 'X';
      const guesses = won ? parseInt(result, 10) : 0;

      // Extract emoji grid (skip first line)
      const emojiLines = lines.slice(1).filter(line => 
        line.includes('⬛') || line.includes('⬜') || 
        line.includes('🟨') || line.includes('🟩')
      );

      return {
        date: this.gameNumberToDate(gameNumber),
        won,
        guesses,
        gameNumber,
        shareText: emojiLines.join('\n')
      };

    } catch (error) {
      console.error('Error parsing share game block:', error);
      return null;
    }
  }

  // Import from CSV file
  async importFromCSV(csvContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      games: []
    };

    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header and one data row');
      }

      const header = lines[0].toLowerCase();
      const expectedColumns = ['date', 'result', 'guesses'];
      
      if (!expectedColumns.every(col => header.includes(col))) {
        throw new Error(`CSV must contain columns: ${expectedColumns.join(', ')}`);
      }

      for (let i = 1; i < lines.length; i++) {
        try {
          const game = this.parseCSVRow(lines[i], header);
          if (game) {
            result.games.push(game);
            result.imported++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  private parseCSVRow(row: string, header: string): GameResult | null {
    const columns = row.split(',').map(col => col.trim().replace(/"/g, ''));
    const headerColumns = header.split(',').map(col => col.trim().toLowerCase());

    const data: any = {};
    headerColumns.forEach((col, index) => {
      data[col] = columns[index];
    });

    if (!data.date || !data.result) return null;

    const won = data.result.toLowerCase() === 'won' || data.result.toLowerCase() === 'true';
    const guesses = parseInt(data.guesses || '0', 10);

    return GameResultModel.fromWordle(
      data.date,
      won,
      guesses,
      data['game number'] ? parseInt(data['game number'], 10) : undefined
    ).get();
  }

  // Import from JSON file
  async importFromJSON(jsonContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      games: []
    };

    try {
      const data = JSON.parse(jsonContent);
      
      let gamesArray: any[] = [];
      
      if (Array.isArray(data)) {
        gamesArray = data;
      } else if (data.games && Array.isArray(data.games)) {
        gamesArray = data.games;
      } else {
        throw new Error('JSON must contain an array of games or have a "games" property');
      }

      for (const [index, gameData] of gamesArray.entries()) {
        try {
          const validation = GameResultModel.validate(gameData);
          if (validation.isValid) {
            result.games.push(gameData);
            result.imported++;
          } else {
            result.errors.push(`Game ${index + 1}: ${validation.errors.join(', ')}`);
          }
        } catch (error) {
          result.errors.push(`Game ${index + 1}: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Invalid JSON format');
      return result;
    }
  }

  // Utility methods
  private gameNumberToDate(gameNumber: number): string {
    // Wordle #1 was on June 19, 2021
    const startDate = new Date('2021-06-19');
    const gameDate = new Date(startDate.getTime() + (gameNumber - 1) * 24 * 60 * 60 * 1000);
    return gameDate.toISOString().split('T')[0];
  }

  private deduplicateGames(games: ParsedWordleGame[]): ParsedWordleGame[] {
    const uniqueGames = new Map<string, ParsedWordleGame>();

    games.forEach(game => {
      const existing = uniqueGames.get(game.date);
      if (!existing || (game.gameNumber && !existing.gameNumber)) {
        uniqueGames.set(game.date, game);
      }
    });

    return Array.from(uniqueGames.values());
  }

  // Convert parsed games to GameResult format
  convertToGameResults(parsedGames: ParsedWordleGame[]): GameResult[] {
    return parsedGames.map(game => 
      GameResultModel.fromWordle(
        game.date,
        game.won,
        game.guesses,
        game.gameNumber
      ).get()
    );
  }

  // Validate import data
  validateImportData(games: GameResult[]): { valid: GameResult[]; invalid: Array<{ game: any; errors: string[] }> } {
    const valid: GameResult[] = [];
    const invalid: Array<{ game: any; errors: string[] }> = [];

    games.forEach(game => {
      const validation = GameResultModel.validate(game);
      if (validation.isValid) {
        valid.push(game);
      } else {
        invalid.push({ game, errors: validation.errors });
      }
    });

    return { valid, invalid };
  }
}

// Export singleton instance
export const dataImportService = DataImportService.getInstance();