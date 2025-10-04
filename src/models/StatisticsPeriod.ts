// StatisticsPeriod model with calculations and analysis
import { GameResult, StatisticsPeriod } from '@/types/gameTypes';
import { TimeFrame } from '@/types/benchmarkTypes';
import GameResultModel from './GameResult';

export class StatisticsPeriodModel {
  private data: StatisticsPeriod;
  private games: GameResultModel[];

  constructor(games: GameResult[], timeFrame: TimeFrame) {
    this.games = games.map(game => new GameResultModel(game));
    this.data = this.calculateStatistics(timeFrame);
  }

  // Static factory methods
  static create(games: GameResult[], timeFrame: TimeFrame): StatisticsPeriodModel {
    return new StatisticsPeriodModel(games, timeFrame);
  }

  static fromDateRange(
    games: GameResult[], 
    startDate: string, 
    endDate: string
  ): StatisticsPeriodModel {
    const filteredGames = games.filter(game => {
      const gameDate = new Date(game.date);
      return gameDate >= new Date(startDate) && gameDate <= new Date(endDate);
    });
    
    return new StatisticsPeriodModel(filteredGames, 'custom');
  }

  // Core statistics calculation
  private calculateStatistics(timeFrame: TimeFrame): StatisticsPeriod {
    const gameCount = this.games.length;
    
    if (gameCount === 0) {
      return this.getEmptyStatistics(timeFrame);
    }

    const wonGames = this.games.filter(game => game.won);
    const winRate = (wonGames.length / gameCount) * 100;
    
    // Average guesses (only for won games)
    const totalGuesses = wonGames.reduce((sum, game) => sum + game.guesses, 0);
    const averageGuesses = wonGames.length > 0 ? totalGuesses / wonGames.length : 0;

    // Streak calculations
    const streaks = this.calculateStreaks();
    
    // Guess distribution
    const guessDistribution = this.calculateGuessDistribution();
    
    // Performance trends
    const trends = this.calculateTrends();

    return {
      timeFrame,
      gameCount,
      winRate,
      averageGuesses,
      currentStreak: streaks.current,
      maxStreak: streaks.max,
      guessDistribution,
      firstGameDate: this.getFirstGameDate(),
      lastGameDate: this.getLastGameDate(),
      trends,
      calculatedAt: new Date().toISOString()
    };
  }

  private getEmptyStatistics(timeFrame: TimeFrame): StatisticsPeriod {
    return {
      timeFrame,
      gameCount: 0,
      winRate: 0,
      averageGuesses: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0],
      firstGameDate: null,
      lastGameDate: null,
      trends: {
        winRateChange: 0,
        averageGuessesChange: 0,
        direction: 'stable'
      },
      calculatedAt: new Date().toISOString()
    };
  }

  // Streak calculations
  private calculateStreaks(): { current: number; max: number } {
    if (this.games.length === 0) {
      return { current: 0, max: 0 };
    }

    // Sort games by date (most recent first)
    const sortedGames = [...this.games].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Calculate current streak (from most recent game)
    for (let i = 0; i < sortedGames.length; i++) {
      const game = sortedGames[i];
      
      if (game.won) {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
        
        // Current streak is only updated if we're at the start
        if (i === 0 || currentStreak === tempStreak - 1) {
          currentStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
        // If we hit a loss and were building current streak, reset it
        if (i === 0) {
          currentStreak = 0;
        }
      }
    }

    return { current: currentStreak, max: maxStreak };
  }

  // Guess distribution calculation
  private calculateGuessDistribution(): number[] {
    const distribution = [0, 0, 0, 0, 0, 0]; // Index 0 = 1 guess, Index 5 = 6 guesses
    
    const wonGames = this.games.filter(game => game.won);
    
    wonGames.forEach(game => {
      const guessIndex = game.guesses - 1; // Convert to 0-based index
      if (guessIndex >= 0 && guessIndex < 6) {
        distribution[guessIndex]++;
      }
    });

    return distribution;
  }

  // Trend analysis
  private calculateTrends(): any {
    if (this.games.length < 10) {
      return {
        winRateChange: 0,
        averageGuessesChange: 0,
        direction: 'stable'
      };
    }

    // Split games into two halves for comparison
    const sortedGames = [...this.games].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const midPoint = Math.floor(sortedGames.length / 2);
    const firstHalf = sortedGames.slice(0, midPoint);
    const secondHalf = sortedGames.slice(midPoint);

    // Calculate stats for each half
    const firstHalfWinRate = (firstHalf.filter(g => g.won).length / firstHalf.length) * 100;
    const secondHalfWinRate = (secondHalf.filter(g => g.won).length / secondHalf.length) * 100;

    const firstHalfWins = firstHalf.filter(g => g.won);
    const secondHalfWins = secondHalf.filter(g => g.won);

    const firstHalfAvg = firstHalfWins.length > 0 
      ? firstHalfWins.reduce((sum, g) => sum + g.guesses, 0) / firstHalfWins.length 
      : 0;
    
    const secondHalfAvg = secondHalfWins.length > 0 
      ? secondHalfWins.reduce((sum, g) => sum + g.guesses, 0) / secondHalfWins.length 
      : 0;

    const winRateChange = secondHalfWinRate - firstHalfWinRate;
    const averageGuessesChange = secondHalfAvg - firstHalfAvg;

    // Determine overall direction
    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    
    if (winRateChange > 5 || (winRateChange > 0 && averageGuessesChange < -0.2)) {
      direction = 'improving';
    } else if (winRateChange < -5 || (winRateChange < 0 && averageGuessesChange > 0.2)) {
      direction = 'declining';
    }

    return {
      winRateChange,
      averageGuessesChange,
      direction
    };
  }

  // Date utilities
  private getFirstGameDate(): string | null {
    if (this.games.length === 0) return null;
    
    const dates = this.games.map(game => game.date).sort();
    return dates[0];
  }

  private getLastGameDate(): string | null {
    if (this.games.length === 0) return null;
    
    const dates = this.games.map(game => game.date).sort();
    return dates[dates.length - 1];
  }

  // Getters
  get(): StatisticsPeriod {
    return { ...this.data };
  }

  get timeFrame(): TimeFrame {
    return this.data.timeFrame;
  }

  get gameCount(): number {
    return this.data.gameCount;
  }

  get winRate(): number {
    return this.data.winRate;
  }

  get averageGuesses(): number {
    return this.data.averageGuesses;
  }

  get currentStreak(): number {
    return this.data.currentStreak;
  }

  get isImproving(): boolean {
    return this.data.trends?.direction === 'improving';
  }

  get isDeclining(): boolean {
    return this.data.trends?.direction === 'declining';
  }

  // Analysis methods
  getBestGuessCount(): number {
    const wonGames = this.games.filter(game => game.won);
    if (wonGames.length === 0) return 0;
    
    return Math.min(...wonGames.map(game => game.guesses));
  }

  getWorstGuessCount(): number {
    const wonGames = this.games.filter(game => game.won);
    if (wonGames.length === 0) return 0;
    
    return Math.max(...wonGames.map(game => game.guesses));
  }

  getMostCommonGuessCount(): number {
    const distribution = this.data.guessDistribution;
    const maxCount = Math.max(...distribution);
    return distribution.indexOf(maxCount) + 1;
  }

  getRecentPerformance(days: number = 7): { winRate: number; averageGuesses: number } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentGames = this.games.filter(game => 
      new Date(game.date) >= cutoffDate
    );

    if (recentGames.length === 0) {
      return { winRate: 0, averageGuesses: 0 };
    }

    const recentWins = recentGames.filter(game => game.won);
    const winRate = (recentWins.length / recentGames.length) * 100;
    const averageGuesses = recentWins.length > 0 
      ? recentWins.reduce((sum, game) => sum + game.guesses, 0) / recentWins.length
      : 0;

    return { winRate, averageGuesses };
  }

  // Comparison methods
  compareTo(other: StatisticsPeriodModel): {
    winRateDiff: number;
    averageGuessesDiff: number;
    streakDiff: number;
    gameCountDiff: number;
  } {
    return {
      winRateDiff: this.data.winRate - other.data.winRate,
      averageGuessesDiff: this.data.averageGuesses - other.data.averageGuesses,
      streakDiff: this.data.currentStreak - other.data.currentStreak,
      gameCountDiff: this.data.gameCount - other.data.gameCount
    };
  }

  // Export methods
  toJSON(): string {
    return JSON.stringify({
      statistics: this.data,
      games: this.games.map(game => game.get())
    }, null, 2);
  }

  toSummaryString(): string {
    const { gameCount, winRate, averageGuesses, currentStreak } = this.data;
    
    return `${gameCount} games, ${winRate.toFixed(1)}% win rate, ` +
           `${averageGuesses.toFixed(1)} avg guesses, ${currentStreak} streak`;
  }
}

export default StatisticsPeriodModel;