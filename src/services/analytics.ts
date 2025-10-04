// Analytics calculation service for advanced statistics and insights
import { GameResult, StatisticsPeriod } from '@/types/gameTypes';
import { TimeFrame } from '@/types/benchmarkTypes';
import GameResultModel from '@/models/GameResult';
import StatisticsPeriodModel from '@/models/StatisticsPeriod';

export interface TrendData {
  dates: string[];
  winRates: number[];
  averageGuesses: number[];
  streaks: number[];
  direction: 'improving' | 'declining' | 'stable';
  confidence: number; // 0-1
}

export interface PatternAnalysis {
  bestDayOfWeek: string;
  worstDayOfWeek: string;
  consistencyScore: number; // 0-100
  improvementRate: number; // % per month
  seasonalTrends: Array<{
    period: string;
    winRate: number;
    averageGuesses: number;
  }>;
}

export interface PerformanceInsights {
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  milestones: Array<{
    description: string;
    achieved: boolean;
    date?: string;
  }>;
}

export interface ComparisonMetrics {
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  percentileRank: number;
  improvementPotential: number; // 0-100
  competitivenessScore: number; // 0-100
}

export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // Calculate comprehensive statistics for a time period
  calculatePeriodStatistics(games: GameResult[], timeFrame: TimeFrame): StatisticsPeriod {
    const model = StatisticsPeriodModel.create(games, timeFrame);
    return model.get();
  }

  // Generate trend analysis
  generateTrendAnalysis(games: GameResult[], windowDays: number = 7): TrendData {
    if (games.length < windowDays) {
      return this.getEmptyTrendData();
    }

    const sortedGames = [...games].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const windows = this.createSlidingWindows(sortedGames, windowDays);
    const dates: string[] = [];
    const winRates: number[] = [];
    const averageGuesses: number[] = [];
    const streaks: number[] = [];

    windows.forEach(window => {
      const stats = this.calculateWindowStats(window.games);
      dates.push(window.endDate);
      winRates.push(stats.winRate);
      averageGuesses.push(stats.averageGuesses);
      streaks.push(stats.currentStreak);
    });

    const direction = this.analyzeTrendDirection(winRates, averageGuesses);
    const confidence = this.calculateTrendConfidence(winRates, averageGuesses);

    return {
      dates,
      winRates,
      averageGuesses,
      streaks,
      direction,
      confidence
    };
  }

  // Analyze playing patterns
  analyzePatterns(games: GameResult[]): PatternAnalysis {
    const dayOfWeekStats = this.analyzeDayOfWeekPatterns(games);
    const consistencyScore = this.calculateConsistencyScore(games);
    const improvementRate = this.calculateImprovementRate(games);
    const seasonalTrends = this.analyzeSeasonalTrends(games);

    return {
      bestDayOfWeek: dayOfWeekStats.best.day,
      worstDayOfWeek: dayOfWeekStats.worst.day,
      consistencyScore,
      improvementRate,
      seasonalTrends
    };
  }

  // Generate performance insights
  generateInsights(games: GameResult[], benchmarkWinRate: number = 98): PerformanceInsights {
    const recentGames = this.getRecentGames(games, 30);
    const allTimeStats = this.calculateBasicStats(games);
    const recentStats = this.calculateBasicStats(recentGames);

    const strengths = this.identifyStrengths(allTimeStats, recentStats, benchmarkWinRate);
    const improvements = this.identifyImprovements(allTimeStats, recentStats, benchmarkWinRate);
    const recommendations = this.generateRecommendations(allTimeStats, recentStats);
    const milestones = this.calculateMilestones(games);

    return {
      strengths,
      improvements,
      recommendations,
      milestones
    };
  }

  // Calculate comparison metrics
  calculateComparisonMetrics(
    games: GameResult[], 
    benchmarkWinRate: number = 98,
    benchmarkAvgGuesses: number = 3.9
  ): ComparisonMetrics {
    const stats = this.calculateBasicStats(games);
    
    const skillLevel = this.determineSkillLevel(stats.winRate, stats.averageGuesses);
    const percentileRank = this.calculatePercentileRank(stats.winRate, benchmarkWinRate);
    const improvementPotential = this.calculateImprovementPotential(stats, benchmarkWinRate, benchmarkAvgGuesses);
    const competitivenessScore = this.calculateCompetitivenessScore(stats, benchmarkWinRate, benchmarkAvgGuesses);

    return {
      skillLevel,
      percentileRank,
      improvementPotential,
      competitivenessScore
    };
  }

  // Advanced analytics methods
  private createSlidingWindows(games: GameResult[], windowDays: number): Array<{ games: GameResult[]; endDate: string }> {
    const windows: Array<{ games: GameResult[]; endDate: string }> = [];
    
    for (let i = windowDays - 1; i < games.length; i++) {
      const windowGames = games.slice(i - windowDays + 1, i + 1);
      const endDate = games[i].date;
      windows.push({ games: windowGames, endDate });
    }

    return windows;
  }

  private calculateWindowStats(games: GameResult[]): { winRate: number; averageGuesses: number; currentStreak: number } {
    const wonGames = games.filter(g => g.won);
    const winRate = games.length > 0 ? (wonGames.length / games.length) * 100 : 0;
    const averageGuesses = wonGames.length > 0 
      ? wonGames.reduce((sum, g) => sum + (g.guesses || 0), 0) / wonGames.length 
      : 0;

    // Calculate current streak from end of window
    let currentStreak = 0;
    for (let i = games.length - 1; i >= 0; i--) {
      if (games[i].won) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { winRate, averageGuesses, currentStreak };
  }

  private analyzeTrendDirection(winRates: number[], averageGuesses: number[]): 'improving' | 'declining' | 'stable' {
    if (winRates.length < 3) return 'stable';

    const recentWinRate = this.calculateSlope(winRates.slice(-5));
    const recentGuesses = this.calculateSlope(averageGuesses.slice(-5));

    if (recentWinRate > 1 || (recentWinRate > 0 && recentGuesses < -0.05)) {
      return 'improving';
    } else if (recentWinRate < -1 || (recentWinRate < 0 && recentGuesses > 0.05)) {
      return 'declining';
    }

    return 'stable';
  }

  private calculateTrendConfidence(winRates: number[], averageGuesses: number[]): number {
    if (winRates.length < 5) return 0.3;

    const winRateVariability = this.calculateVariability(winRates);
    const guessesVariability = this.calculateVariability(averageGuesses);

    // Higher confidence with more data and lower variability
    const dataConfidence = Math.min(winRates.length / 20, 1);
    const stabilityConfidence = Math.max(0, 1 - (winRateVariability + guessesVariability) / 2);

    return (dataConfidence + stabilityConfidence) / 2;
  }

  private analyzeDayOfWeekPatterns(games: GameResult[]): { 
    best: { day: string; winRate: number }; 
    worst: { day: string; winRate: number } 
  } {
    const dayStats = new Map<string, { wins: number; total: number }>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    games.forEach(game => {
      const date = new Date(game.date);
      const dayName = dayNames[date.getDay()];
      
      const stats = dayStats.get(dayName) || { wins: 0, total: 0 };
      stats.total++;
      if (game.won) stats.wins++;
      dayStats.set(dayName, stats);
    });

    let bestDay = { day: 'Monday', winRate: 0 };
    let worstDay = { day: 'Monday', winRate: 100 };

    dayStats.forEach((stats, day) => {
      if (stats.total >= 3) { // Only consider days with enough games
        const winRate = (stats.wins / stats.total) * 100;
        if (winRate > bestDay.winRate) {
          bestDay = { day, winRate };
        }
        if (winRate < worstDay.winRate) {
          worstDay = { day, winRate };
        }
      }
    });

    return { best: bestDay, worst: worstDay };
  }

  private calculateConsistencyScore(games: GameResult[]): number {
    if (games.length < 10) return 50;

    const recentGames = this.getRecentGames(games, 30);
    const recentWinRate = this.calculateBasicStats(recentGames).winRate;
    const overallWinRate = this.calculateBasicStats(games).winRate;

    const winRateConsistency = Math.max(0, 100 - Math.abs(recentWinRate - overallWinRate) * 2);

    // Check guess count consistency for won games
    const wonGames = games.filter(g => g.won);
    const guessCountVariability = wonGames.length > 5 
      ? this.calculateVariability(wonGames.map(g => g.guesses || 0))
      : 0.5;

    const guessConsistency = Math.max(0, 100 - guessCountVariability * 100);

    return (winRateConsistency + guessConsistency) / 2;
  }

  private calculateImprovementRate(games: GameResult[]): number {
    if (games.length < 30) return 0;

    const sortedGames = [...games].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstHalf = sortedGames.slice(0, Math.floor(sortedGames.length / 2));
    const secondHalf = sortedGames.slice(Math.floor(sortedGames.length / 2));

    const firstHalfWinRate = this.calculateBasicStats(firstHalf).winRate;
    const secondHalfWinRate = this.calculateBasicStats(secondHalf).winRate;

    const improvement = secondHalfWinRate - firstHalfWinRate;
    const timeSpanDays = (new Date(sortedGames[sortedGames.length - 1].date).getTime() - 
                         new Date(sortedGames[0].date).getTime()) / (1000 * 60 * 60 * 24);
    
    // Convert to monthly improvement rate
    return (improvement / timeSpanDays) * 30;
  }

  private analyzeSeasonalTrends(games: GameResult[]): Array<{ period: string; winRate: number; averageGuesses: number }> {
    const seasonalData = new Map<string, GameResult[]>();
    
    games.forEach(game => {
      const date = new Date(game.date);
      const month = date.getMonth();
      
      let season: string;
      if (month >= 2 && month <= 4) season = 'Spring';
      else if (month >= 5 && month <= 7) season = 'Summer';
      else if (month >= 8 && month <= 10) season = 'Fall';
      else season = 'Winter';
      
      const seasonGames = seasonalData.get(season) || [];
      seasonGames.push(game);
      seasonalData.set(season, seasonGames);
    });

    const trends: Array<{ period: string; winRate: number; averageGuesses: number }> = [];
    
    seasonalData.forEach((seasonGames, season) => {
      if (seasonGames.length >= 5) {
        const stats = this.calculateBasicStats(seasonGames);
        trends.push({
          period: season,
          winRate: stats.winRate,
          averageGuesses: stats.averageGuesses
        });
      }
    });

    return trends;
  }

  private identifyStrengths(
    allTimeStats: any, 
    recentStats: any, 
    benchmarkWinRate: number
  ): string[] {
    const strengths: string[] = [];

    if (allTimeStats.winRate > benchmarkWinRate + 2) {
      strengths.push('Consistently high win rate above average');
    }

    if (allTimeStats.averageGuesses < 3.7) {
      strengths.push('Excellent guess efficiency');
    }

    if (recentStats.winRate > allTimeStats.winRate + 3) {
      strengths.push('Recently improving performance');
    }

    if (allTimeStats.maxStreak > 20) {
      strengths.push('Ability to maintain long winning streaks');
    }

    if (strengths.length === 0) {
      strengths.push('Steady improvement and consistent play');
    }

    return strengths;
  }

  private identifyImprovements(
    allTimeStats: any, 
    recentStats: any, 
    benchmarkWinRate: number
  ): string[] {
    const improvements: string[] = [];

    if (allTimeStats.winRate < benchmarkWinRate - 5) {
      improvements.push('Focus on solving more puzzles successfully');
    }

    if (allTimeStats.averageGuesses > 4.2) {
      improvements.push('Work on guess efficiency and strategy');
    }

    if (recentStats.winRate < allTimeStats.winRate - 5) {
      improvements.push('Recent performance has declined');
    }

    if (allTimeStats.currentStreak === 0 && allTimeStats.gameCount > 10) {
      improvements.push('Build consistency to start a winning streak');
    }

    return improvements;
  }

  private generateRecommendations(allTimeStats: any, recentStats: any): string[] {
    const recommendations: string[] = [];

    if (allTimeStats.averageGuesses > 4.0) {
      recommendations.push('Try starting with words containing common vowels');
      recommendations.push('Focus on eliminating multiple letters per guess');
    }

    if (allTimeStats.winRate < 95) {
      recommendations.push('Take time to think through each guess carefully');
      recommendations.push('Consider using hard mode to improve strategy');
    }

    if (recentStats.winRate < allTimeStats.winRate) {
      recommendations.push('Review recent failed games to identify patterns');
      recommendations.push('Take breaks to avoid fatigue affecting performance');
    }

    return recommendations;
  }

  private calculateMilestones(games: GameResult[]): Array<{ description: string; achieved: boolean; date?: string }> {
    const stats = this.calculateBasicStats(games);
    const milestones = [
      { target: 10, description: 'Play 10 games' },
      { target: 50, description: 'Play 50 games' },
      { target: 100, description: 'Play 100 games' },
      { target: 95, description: 'Achieve 95% win rate', isWinRate: true },
      { target: 98, description: 'Achieve 98% win rate', isWinRate: true },
      { target: 10, description: 'Reach 10 game win streak', isStreak: true },
      { target: 25, description: 'Reach 25 game win streak', isStreak: true },
      { target: 50, description: 'Reach 50 game win streak', isStreak: true }
    ];

    return milestones.map(milestone => {
      let achieved = false;
      let date: string | undefined;

      if (milestone.isWinRate) {
        achieved = stats.winRate >= milestone.target;
      } else if (milestone.isStreak) {
        achieved = stats.maxStreak >= milestone.target;
      } else {
        achieved = stats.gameCount >= milestone.target;
        if (achieved && games.length >= milestone.target) {
          const sortedGames = [...games].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          date = sortedGames[milestone.target - 1]?.date;
        }
      }

      return {
        description: milestone.description,
        achieved,
        date
      };
    });
  }

  private determineSkillLevel(winRate: number, averageGuesses: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (winRate >= 99 && averageGuesses <= 3.5) return 'expert';
    if (winRate >= 97 && averageGuesses <= 3.8) return 'advanced';
    if (winRate >= 93 && averageGuesses <= 4.2) return 'intermediate';
    return 'beginner';
  }

  private calculatePercentileRank(userWinRate: number, benchmarkWinRate: number): number {
    // Simple percentile estimation
    const diff = userWinRate - benchmarkWinRate;
    const percentile = 50 + (diff / 20) * 50; // Rough approximation
    return Math.max(1, Math.min(99, percentile));
  }

  private calculateImprovementPotential(
    stats: any, 
    benchmarkWinRate: number, 
    benchmarkAvgGuesses: number
  ): number {
    const winRatePotential = Math.max(0, benchmarkWinRate + 2 - stats.winRate);
    const guessPotential = Math.max(0, stats.averageGuesses - (benchmarkAvgGuesses - 0.2));
    
    return Math.min(100, (winRatePotential * 10) + (guessPotential * 20));
  }

  private calculateCompetitivenessScore(
    stats: any, 
    benchmarkWinRate: number, 
    benchmarkAvgGuesses: number
  ): number {
    const winRateScore = (stats.winRate / benchmarkWinRate) * 50;
    const efficiencyScore = Math.max(0, 50 - (stats.averageGuesses - benchmarkAvgGuesses) * 20);
    
    return Math.min(100, winRateScore + efficiencyScore);
  }

  // Helper methods
  private getEmptyTrendData(): TrendData {
    return {
      dates: [],
      winRates: [],
      averageGuesses: [],
      streaks: [],
      direction: 'stable',
      confidence: 0
    };
  }

  private getRecentGames(games: GameResult[], days: number): GameResult[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return games.filter(game => new Date(game.date) >= cutoffDate);
  }

  private calculateBasicStats(games: GameResult[]): any {
    if (games.length === 0) {
      return { winRate: 0, averageGuesses: 0, gameCount: 0, currentStreak: 0, maxStreak: 0 };
    }

    const wonGames = games.filter(g => g.won);
    const winRate = (wonGames.length / games.length) * 100;
    const averageGuesses = wonGames.length > 0 
      ? wonGames.reduce((sum, g) => sum + (g.guesses || 0), 0) / wonGames.length 
      : 0;

    const sortedGames = [...games].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (const game of sortedGames) {
      if (game.won) {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
        if (currentStreak === tempStreak - 1) {
          currentStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
        if (currentStreak > 0 && currentStreak === tempStreak + 1) {
          currentStreak = 0;
        }
      }
    }

    return {
      winRate,
      averageGuesses,
      gameCount: games.length,
      currentStreak,
      maxStreak
    };
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateVariability(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();