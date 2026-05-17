// BenchmarkData model with comparison and analysis utilities
import { BenchmarkData, BenchmarkStats, BenchmarkSource, TimeFrame } from '@/types/benchmarkTypes';
import { StatisticsPeriod, ComparisonResult } from '@/types/gameTypes';

type NormalizedBenchmarkData = BenchmarkData & {
  timeFrame: TimeFrame;
  stats: BenchmarkStats;
  metadata?: unknown;
};

export class BenchmarkDataModel {
  private data: NormalizedBenchmarkData;

  constructor(data: Partial<BenchmarkData>) {
    this.data = this.validateAndNormalize(data);
  }

  // Static factory methods
  static create(data: Partial<BenchmarkData>): BenchmarkDataModel {
    return new BenchmarkDataModel(data);
  }

  static createNationalAverage(stats: BenchmarkStats): BenchmarkDataModel {
    return new BenchmarkDataModel({
      source: 'national',
      timeFrame: '30d',
      stats,
      lastUpdated: new Date().toISOString(),
      sampleSize: 1000000 // Estimated national sample
    });
  }

  static createWordleBotBenchmark(stats: BenchmarkStats): BenchmarkDataModel {
    return new BenchmarkDataModel({
      source: 'wordlebot',
      timeFrame: 'all',
      stats,
      lastUpdated: new Date().toISOString(),
      sampleSize: 0 // WordleBot doesn't provide sample sizes
    });
  }

  static fromJSON(json: string): BenchmarkDataModel {
    try {
      const data = JSON.parse(json);
      return new BenchmarkDataModel(data);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error}`);
    }
  }

  // Validation and normalization
  private validateAndNormalize(data: Partial<BenchmarkData>): NormalizedBenchmarkData {
    const errors: string[] = [];

    // Required fields validation
    if (!data.source) {
      errors.push('Source is required');
    }

    if (!data.timeFrame) {
      errors.push('Time frame is required');
    }

    if (!data.stats) {
      errors.push('Statistics are required');
    } else {
      const statsErrors = this.validateStats(data.stats);
      errors.push(...statsErrors);
    }

    if (data.sampleSize !== null && data.sampleSize !== undefined) {
      if (typeof data.sampleSize !== 'number' || data.sampleSize <= 0) {
        errors.push('Sample size must be a positive number or null');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      source: data.source!,
      timeFrame: data.timeFrame!,
      stats: data.stats!,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      sampleSize: data.sampleSize ?? data.stats!.sampleSize ?? 0,
      winRate: data.winRate ?? data.stats!.winRate,
      averageGuesses: data.averageGuesses ?? data.stats!.averageGuesses,
      guessDistribution: data.guessDistribution ?? data.stats!.guessDistribution ?? [0, 0, 0, 0, 0, 0, 0],
      coverage: data.coverage ?? data.stats!.coverage ?? 100,
      metadata: (data as { metadata?: unknown }).metadata
    };
  }

  private validateStats(stats: BenchmarkStats): string[] {
    const errors: string[] = [];

    if (typeof stats.winRate !== 'number' || stats.winRate < 0 || stats.winRate > 100) {
      errors.push('Win rate must be between 0 and 100');
    }

    if (typeof stats.averageGuesses !== 'number' || stats.averageGuesses < 1 || stats.averageGuesses > 6) {
      errors.push('Average guesses must be between 1 and 6');
    }

    if (stats.guessDistribution) {
      if (!Array.isArray(stats.guessDistribution) || stats.guessDistribution.length !== 6) {
        errors.push('Guess distribution must be an array of 6 numbers');
      } else {
        const sum = stats.guessDistribution.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 0.1) { // Allow small floating point errors
          errors.push('Guess distribution percentages must sum to approximately 100');
        }
      }
    }

    return errors;
  }

  // Getters
  get(): BenchmarkData {
    return { ...this.data };
  }

  get source(): BenchmarkSource {
    return this.data.source;
  }

  get timeFrame(): TimeFrame {
    return this.data.timeFrame;
  }

  get stats(): BenchmarkStats {
    return { ...this.data.stats };
  }

  get winRate(): number {
    return this.data.stats.winRate;
  }

  get averageGuesses(): number {
    return this.data.stats.averageGuesses;
  }

  get isNational(): boolean {
    return this.data.source === 'national';
  }

  get isWordleBot(): boolean {
    return this.data.source === 'wordlebot';
  }

  get isRecent(): boolean {
    const lastUpdate = new Date(this.data.lastUpdated);
    const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }

  // Comparison methods
  compareToUserStats(userStats: StatisticsPeriod): ComparisonResult {
    const winRateDiff = userStats.winRate - this.data.stats.winRate;
    const averageGuessesDiff = userStats.averageGuesses - this.data.stats.averageGuesses;

    // Calculate percentile estimates
    const winRatePercentile = this.estimatePercentile(userStats.winRate, 'winRate');
    const guessesPercentile = this.estimatePercentile(userStats.averageGuesses, 'averageGuesses');

    return {
      benchmarkSource: this.data.source,
      benchmarkStats: this.data,
      winRateDelta: winRateDiff,
      averageGuessesDelta: averageGuessesDiff,
      significanceLevel: this.calculateOverallRank(winRatePercentile, guessesPercentile) / 100,
      beatsBenchmark: winRateDiff >= 0 && averageGuessesDiff <= 0
    };
  }

  private estimatePercentile(value: number, metric: 'winRate' | 'averageGuesses'): number {
    // Simple percentile estimation based on normal distribution assumptions
    // In a real implementation, this would use actual data distributions
    
    if (metric === 'winRate') {
      const benchmarkWinRate = this.data.stats.winRate;
      const stdDev = 15; // Estimated standard deviation for win rates
      
      const zScore = (value - benchmarkWinRate) / stdDev;
      return Math.max(0, Math.min(100, 50 + (zScore * 34.13)));
    } else {
      const benchmarkGuesses = this.data.stats.averageGuesses;
      const stdDev = 0.5; // Estimated standard deviation for average guesses
      
      // Lower guesses = higher percentile (inverted)
      const zScore = (benchmarkGuesses - value) / stdDev;
      return Math.max(0, Math.min(100, 50 + (zScore * 34.13)));
    }
  }

  private calculateOverallRank(winRatePercentile: number, guessesPercentile: number): number {
    // Weighted average favoring win rate slightly
    return (winRatePercentile * 0.6) + (guessesPercentile * 0.4);
  }

  private generateInsights(
    winRateDiff: number, 
    averageGuessesDiff: number, 
    winRatePercentile: number
  ): string[] {
    const insights: string[] = [];

    // Win rate insights
    if (winRateDiff > 10) {
      insights.push(`Excellent! Your win rate is ${winRateDiff.toFixed(1)}% above average.`);
    } else if (winRateDiff > 5) {
      insights.push(`Great job! You're winning more than most players.`);
    } else if (winRateDiff < -10) {
      insights.push(`Your win rate has room for improvement. Focus on strategy.`);
    } else if (winRateDiff < -5) {
      insights.push(`You're slightly below average. Consider trying different starting words.`);
    } else {
      insights.push(`Your win rate is close to the average player.`);
    }

    // Guess efficiency insights
    if (averageGuessesDiff < -0.3) {
      insights.push(`Outstanding efficiency! You solve puzzles faster than most.`);
    } else if (averageGuessesDiff < -0.1) {
      insights.push(`Good efficiency in your solving approach.`);
    } else if (averageGuessesDiff > 0.3) {
      insights.push(`You could improve efficiency by focusing on vowel placement.`);
    } else if (averageGuessesDiff > 0.1) {
      insights.push(`Your guess count is slightly above average.`);
    }

    // Percentile insights
    if (winRatePercentile > 90) {
      insights.push(`You're in the top 10% of players! 🏆`);
    } else if (winRatePercentile > 75) {
      insights.push(`You're performing better than 3 out of 4 players! 📈`);
    } else if (winRatePercentile < 25) {
      insights.push(`There's lots of room to grow your skills! 🎯`);
    }

    return insights;
  }

  // Update methods
  update(updates: Partial<BenchmarkData>): BenchmarkDataModel {
    const updatedData = { ...this.data, ...updates };
    return new BenchmarkDataModel(updatedData);
  }

  updateStats(newStats: BenchmarkStats): BenchmarkDataModel {
    return this.update({ 
      stats: newStats, 
      lastUpdated: new Date().toISOString() 
    });
  }

  // Utility methods
  getDisplayName(): string {
    switch (this.data.source) {
      case 'national':
        return 'National Average';
      case 'wordlebot':
        return 'WordleBot';
      default:
        return 'Unknown Source';
    }
  }

  getTimeFrameDisplay(): string {
    switch (this.data.timeFrame) {
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      case '90d':
        return 'Last 90 Days';
      case 'all':
        return 'All Time';
      default:
        return this.data.timeFrame;
    }
  }

  getFormattedSampleSize(): string {
    if (!this.data.sampleSize) return 'Unknown sample size';
    
    if (this.data.sampleSize >= 1000000) {
      return `${(this.data.sampleSize / 1000000).toFixed(1)}M players`;
    } else if (this.data.sampleSize >= 1000) {
      return `${(this.data.sampleSize / 1000).toFixed(1)}K players`;
    }
    return `${this.data.sampleSize} players`;
  }

  getLastUpdatedDisplay(): string {
    const date = new Date(this.data.lastUpdated);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Export methods
  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  toSummaryString(): string {
    const { stats } = this.data;
    return `${this.getDisplayName()}: ${stats.winRate.toFixed(1)}% win rate, ` +
           `${stats.averageGuesses.toFixed(1)} avg guesses`;
  }

  // Validation utilities
  static validate(data: any): { isValid: boolean; errors: string[] } {
    try {
      new BenchmarkDataModel(data);
      return { isValid: true, errors: [] };
    } catch (error) {
      return { 
        isValid: false, 
        errors: [error instanceof Error ? error.message : 'Unknown validation error'] 
      };
    }
  }

  static isValidBenchmarkData(data: any): data is BenchmarkData {
    const validation = BenchmarkDataModel.validate(data);
    return validation.isValid;
  }
}

export default BenchmarkDataModel;