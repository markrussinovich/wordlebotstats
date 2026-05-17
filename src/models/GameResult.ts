// GameResult model with validation and utility methods
import { GameResult, GuessResult } from '@/types/gameTypes';

export class GameResultModel {
  private data: GameResult;

  constructor(data: Partial<GameResult>) {
    this.data = this.validateAndNormalize(data);
  }

  // Static factory methods
  static create(data: Partial<GameResult>): GameResultModel {
    return new GameResultModel(data);
  }

  static fromWordle(
    date: string,
    won: boolean,
    guesses: number,
    gameNumber?: number
  ): GameResultModel {
    return new GameResultModel({
      date,
      won,
      guesses,
      maxGuesses: 6,
      duration: 0,
      wordLength: 5,
      gameNumber,
      source: 'wordle-page',
      importedAt: new Date().toISOString(),
      guessDistribution: [],
      hardMode: false
    });
  }

  static fromJSON(json: string): GameResultModel {
    try {
      const data = JSON.parse(json);
      return new GameResultModel(data);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error}`);
    }
  }

  // Validation and normalization
  private validateAndNormalize(data: Partial<GameResult>): GameResult {
    const errors: string[] = [];

    // Required fields validation
    if (!data.date) {
      errors.push('Date is required');
    } else if (!this.isValidDate(data.date)) {
      errors.push('Date must be in YYYY-MM-DD format');
    }

    if (typeof data.won !== 'boolean') {
      errors.push('Won status must be boolean');
    }

    if (typeof data.guesses !== 'number' || data.guesses < 0) {
      errors.push('Guesses must be a non-negative number');
    }

    if (typeof data.maxGuesses !== 'number' || data.maxGuesses <= 0) {
      errors.push('Max guesses must be a positive number');
    }

    // Business logic validation
    if (data.won && (!data.guesses || data.guesses === 0)) {
      errors.push('Won games must have at least 1 guess');
    }

    if (data.guesses && data.maxGuesses && data.guesses > data.maxGuesses) {
      errors.push('Guesses cannot exceed max guesses');
    }

    if (data.wordLength && (data.wordLength < 3 || data.wordLength > 10)) {
      errors.push('Word length must be between 3 and 10');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Normalize and set defaults
    return {
      date: data.date!,
      won: data.won!,
      attempts: data.guesses ?? data.attempts ?? 0,
      guesses: data.guesses || 0,
      maxGuesses: data.maxGuesses || 6,
      duration: data.duration || 0,
      wordLength: data.wordLength || 5,
      gameNumber: data.gameNumber,
      source: data.source || 'manual',
      importedAt: data.importedAt || new Date().toISOString(),
      guessDistribution: data.guessDistribution || [],
      hardMode: data.hardMode || false,
      solution: data.solution,
      metadata: data.metadata
    };
  }

  private isValidDate(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    
    const dateObj = new Date(date);
    return dateObj.toISOString().split('T')[0] === date;
  }

  // Getters
  get(): GameResult {
    return { ...this.data };
  }

  get date(): string {
    return this.data.date;
  }

  get won(): boolean {
    return this.data.won;
  }

  get guesses(): number {
    return this.data.guesses ?? this.data.attempts ?? 0;
  }

  get efficiency(): number {
    if (!this.data.won) return 0;
    const maxGuesses = this.data.maxGuesses ?? 6;
    const guesses = this.guesses;
    return (maxGuesses - guesses + 1) / maxGuesses;
  }

  get isRecent(): boolean {
    const gameDate = new Date(this.data.date);
    const daysDiff = (Date.now() - gameDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  }

  // Utility methods
  getDayOfWeek(): string {
    const date = new Date(this.data.date);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  getFormattedDate(): string {
    const date = new Date(this.data.date);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  getDurationFormatted(): string {
    if (!this.data.duration) return 'Unknown';
    
    const minutes = Math.floor(this.data.duration / 60);
    const seconds = this.data.duration % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  // Comparison methods
  equals(other: GameResultModel): boolean {
    return this.data.date === other.data.date;
  }

  isAfter(other: GameResultModel): boolean {
    return new Date(this.data.date) > new Date(other.data.date);
  }

  isBefore(other: GameResultModel): boolean {
    return new Date(this.data.date) < new Date(other.data.date);
  }

  // Update methods
  update(updates: Partial<GameResult>): GameResultModel {
    const updatedData = { ...this.data, ...updates };
    return new GameResultModel(updatedData);
  }

  addGuess(guess: GuessResult): GameResultModel {
    const guessPattern = [...(this.data.guessPattern ?? []), [guess]];
    return this.update({ guessPattern });
  }

  setMetadata(key: string, value: any): GameResultModel {
    const metadata = { ...this.data.metadata, [key]: value };
    return this.update({ metadata });
  }

  // Export methods
  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  toCSVRow(): string {
    const {
      date,
      won,
      guesses,
      maxGuesses,
      duration,
      wordLength,
      gameNumber,
      source,
      hardMode,
      solution
    } = this.data;

    return [
      date,
      won ? 'Won' : 'Lost',
      guesses,
      maxGuesses,
      duration,
      wordLength,
      gameNumber || '',
      source,
      hardMode ? 'Hard' : 'Normal',
      solution || ''
    ].join(',');
  }

  static getCSVHeader(): string {
    return 'Date,Result,Guesses,Max Guesses,Duration,Word Length,Game Number,Source,Mode,Solution';
  }

  // Validation utilities
  static validate(data: any): { isValid: boolean; errors: string[] } {
    try {
      new GameResultModel(data);
      return { isValid: true, errors: [] };
    } catch (error) {
      return { 
        isValid: false, 
        errors: [error instanceof Error ? error.message : 'Unknown validation error'] 
      };
    }
  }

  static isValidGameResult(data: any): data is GameResult {
    const validation = GameResultModel.validate(data);
    return validation.isValid;
  }
}

export default GameResultModel;