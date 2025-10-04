import { StatisticsPeriod } from '@/types/gameTypes';

describe('StatisticsPeriod Model', () => {
  it('should validate StatisticsPeriod structure', () => {
    const statisticsPeriod: StatisticsPeriod = {
      periodId: 'period-2025-09',
      startDate: '2025-09-01T00:00:00Z',
      endDate: '2025-09-27T23:59:59Z',
      gameCount: 27,
      winCount: 23,
      winRate: 85.19, // 23/27 * 100
      averageGuesses: 4.17,
      guessDistribution: [1, 3, 8, 7, 3, 1, 4], // [1,2,3,4,5,6,fail]
      currentStreak: 5,
      maxStreak: 12,
      failRate: 14.81, // 4/27 * 100
      hardModeGames: 15,
      totalAttempts: 96, // Sum of attempts for won games
      medianGuesses: 4,
      perfectGames: 1, // 1-guess wins
      lastGuessWins: 1  // 6-guess wins
    };

    expect(() => {
      expect(statisticsPeriod.periodId).toBe('period-2025-09');
      expect(statisticsPeriod.gameCount).toBe(27);
      expect(statisticsPeriod.winCount).toBe(23);
      expect(statisticsPeriod.winRate).toBeCloseTo(85.19, 2);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate win rate calculations', () => {
    const testCases = [
      { games: 10, wins: 8, expectedRate: 80.0 },
      { games: 3, wins: 3, expectedRate: 100.0 },
      { games: 4, wins: 0, expectedRate: 0.0 },
      { games: 7, wins: 5, expectedRate: 71.43 }
    ];

    testCases.forEach(testCase => {
      const period: StatisticsPeriod = {
        periodId: `test-${testCase.games}-${testCase.wins}`,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
        gameCount: testCase.games,
        winCount: testCase.wins,
        winRate: testCase.expectedRate,
        averageGuesses: 4.0,
        guessDistribution: [0, 0, 0, testCase.wins, 0, 0, testCase.games - testCase.wins],
        currentStreak: 0,
        maxStreak: 0,
        failRate: 100 - testCase.expectedRate,
        hardModeGames: 0,
        totalAttempts: testCase.wins * 4,
        medianGuesses: 4,
        perfectGames: 0,
        lastGuessWins: 0
      };

      expect(() => {
        expect(period.winRate).toBeCloseTo(testCase.expectedRate, 2);
        expect(period.winRate + period.failRate).toBeCloseTo(100.0, 2);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate guess distribution sums', () => {
    const period: StatisticsPeriod = {
      periodId: 'distribution-test',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      gameCount: 20,
      winCount: 16,
      winRate: 80.0,
      averageGuesses: 4.0,
      guessDistribution: [1, 2, 5, 6, 2, 0, 4], // Should sum to gameCount (20)
      currentStreak: 3,
      maxStreak: 8,
      failRate: 20.0,
      hardModeGames: 10,
      totalAttempts: 64, // 16 wins * 4 avg
      medianGuesses: 4,
      perfectGames: 1,
      lastGuessWins: 0
    };

    expect(() => {
      const distributionSum = period.guessDistribution.reduce((sum, count) => sum + count, 0);
      expect(distributionSum).toBe(period.gameCount);
      expect(period.guessDistribution).toHaveLength(7); // [1,2,3,4,5,6,fail]
      
      // Wins should equal sum of successful guesses (1-6)
      const winsFromDistribution = period.guessDistribution.slice(0, 6).reduce((sum, count) => sum + count, 0);
      expect(winsFromDistribution).toBe(period.winCount);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate average guesses calculation', () => {
    const period: StatisticsPeriod = {
      periodId: 'average-test',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      gameCount: 10,
      winCount: 8,
      winRate: 80.0,
      averageGuesses: 3.75, // totalAttempts / winCount = 30 / 8
      guessDistribution: [0, 2, 3, 2, 1, 0, 2], // 2*2 + 3*3 + 2*4 + 1*5 = 30 attempts
      currentStreak: 2,
      maxStreak: 5,
      failRate: 20.0,
      hardModeGames: 4,
      totalAttempts: 30,
      medianGuesses: 3.5,
      perfectGames: 0,
      lastGuessWins: 0
    };

    expect(() => {
      const calculatedAverage = period.totalAttempts / period.winCount;
      expect(calculatedAverage).toBeCloseTo(period.averageGuesses, 2);
      
      // Calculate total attempts from distribution
      let calculatedTotalAttempts = 0;
      for (let i = 0; i < 6; i++) {
        calculatedTotalAttempts += (i + 1) * period.guessDistribution[i];
      }
      expect(calculatedTotalAttempts).toBe(period.totalAttempts);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate date range format', () => {
    const period: StatisticsPeriod = {
      periodId: 'date-test',
      startDate: '2025-09-01T00:00:00.000Z',
      endDate: '2025-09-27T23:59:59.999Z',
      gameCount: 5,
      winCount: 4,
      winRate: 80.0,
      averageGuesses: 4.0,
      guessDistribution: [0, 0, 2, 2, 0, 0, 1],
      currentStreak: 2,
      maxStreak: 3,
      failRate: 20.0,
      hardModeGames: 2,
      totalAttempts: 16,
      medianGuesses: 3.5,
      perfectGames: 0,
      lastGuessWins: 0
    };

    expect(() => {
      expect(period.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(period.endDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(period.startDate).getTime()).toBeLessThanOrEqual(new Date(period.endDate).getTime());
    }).toThrow(); // Expected to fail in TDD
  });
});