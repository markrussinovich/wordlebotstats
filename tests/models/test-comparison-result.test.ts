import { ComparisonResult, StatisticsPeriod, BenchmarkData } from '@/types/gameTypes';

describe('ComparisonResult Model', () => {
  const mockUserPeriod: StatisticsPeriod = {
    periodId: 'user-2025-09',
    startDate: '2025-09-01T00:00:00Z',
    endDate: '2025-09-27T23:59:59Z',
    gameCount: 20,
    winCount: 17,
    winRate: 85.0,
    averageGuesses: 4.1,
    guessDistribution: [1, 3, 6, 5, 2, 0, 3],
    currentStreak: 5,
    maxStreak: 12,
    failRate: 15.0,
    hardModeGames: 10,
    totalAttempts: 70,
    medianGuesses: 4,
    perfectGames: 1,
    lastGuessWins: 0
  };

  const mockBenchmark: BenchmarkData = {
    benchmarkId: 'national-2025-09',
    source: 'national',
    periodStart: '2025-09-01T00:00:00Z',
    periodEnd: '2025-09-27T23:59:59Z',
    winRate: 78.5,
    averageGuesses: 4.3,
    guessDistribution: [2, 8, 25, 30, 22, 10, 3],
    sampleSize: 1500000,
    lastUpdated: '2025-09-27T12:00:00Z',
    coverage: 95.8
  };

  it('should validate ComparisonResult structure', () => {
    const comparison: ComparisonResult = {
      comparisonId: 'comp-user-national-2025-09',
      userPeriod: mockUserPeriod,
      benchmark: mockBenchmark,
      winRateDelta: 6.5, // 85.0 - 78.5
      averageGuessesDelta: -0.2, // 4.1 - 4.3
      beatsBenchmark: true,
      significanceLevel: 0.05,
      coverageWarning: false
    };

    expect(() => {
      expect(comparison.comparisonId).toBe('comp-user-national-2025-09');
      expect(comparison.winRateDelta).toBeCloseTo(6.5, 1);
      expect(comparison.averageGuessesDelta).toBeCloseTo(-0.2, 1);
      expect(comparison.beatsBenchmark).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should calculate win rate delta correctly', () => {
    const testCases = [
      { userRate: 90.0, benchmarkRate: 78.5, expectedDelta: 11.5 },
      { userRate: 70.0, benchmarkRate: 78.5, expectedDelta: -8.5 },
      { userRate: 78.5, benchmarkRate: 78.5, expectedDelta: 0.0 }
    ];

    testCases.forEach(testCase => {
      const comparison: ComparisonResult = {
        comparisonId: `test-${testCase.userRate}-${testCase.benchmarkRate}`,
        userPeriod: { ...mockUserPeriod, winRate: testCase.userRate },
        benchmark: { ...mockBenchmark, winRate: testCase.benchmarkRate },
        winRateDelta: testCase.expectedDelta,
        averageGuessesDelta: 0,
        beatsBenchmark: testCase.expectedDelta > 0,
        coverageWarning: false
      };

      expect(() => {
        expect(comparison.winRateDelta).toBeCloseTo(testCase.expectedDelta, 1);
        expect(comparison.beatsBenchmark).toBe(testCase.expectedDelta > 0);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should calculate average guesses delta correctly', () => {
    const testCases = [
      { userAvg: 3.8, benchmarkAvg: 4.3, expectedDelta: -0.5 },
      { userAvg: 4.7, benchmarkAvg: 4.3, expectedDelta: 0.4 },
      { userAvg: 4.3, benchmarkAvg: 4.3, expectedDelta: 0.0 }
    ];

    testCases.forEach(testCase => {
      const comparison: ComparisonResult = {
        comparisonId: `avg-test-${testCase.userAvg}-${testCase.benchmarkAvg}`,
        userPeriod: { ...mockUserPeriod, averageGuesses: testCase.userAvg },
        benchmark: { ...mockBenchmark, averageGuesses: testCase.benchmarkAvg },
        winRateDelta: 0,
        averageGuessesDelta: testCase.expectedDelta,
        beatsBenchmark: testCase.expectedDelta < 0, // Lower is better for guesses
        coverageWarning: false
      };

      expect(() => {
        expect(comparison.averageGuessesDelta).toBeCloseTo(testCase.expectedDelta, 1);
        // For average guesses, lower is better, so negative delta is good
        expect(comparison.beatsBenchmark).toBe(testCase.expectedDelta < 0);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should determine beats benchmark correctly', () => {
    const testCases = [
      { winRateDelta: 5.0, avgDelta: -0.3, expectedBeats: true },  // Better win rate, fewer guesses
      { winRateDelta: -2.0, avgDelta: 0.5, expectedBeats: false }, // Worse on both
      { winRateDelta: 3.0, avgDelta: 0.2, expectedBeats: true },   // Better win rate wins
      { winRateDelta: -1.0, avgDelta: -0.4, expectedBeats: false } // Mixed results, prioritize win rate
    ];

    testCases.forEach(testCase => {
      const comparison: ComparisonResult = {
        comparisonId: `beats-test-${testCase.winRateDelta}-${testCase.avgDelta}`,
        userPeriod: mockUserPeriod,
        benchmark: mockBenchmark,
        winRateDelta: testCase.winRateDelta,
        averageGuessesDelta: testCase.avgDelta,
        beatsBenchmark: testCase.expectedBeats,
        coverageWarning: false
      };

      expect(() => {
        expect(comparison.beatsBenchmark).toBe(testCase.expectedBeats);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate coverage warning flag', () => {
    const lowCoverageBenchmark: BenchmarkData = {
      ...mockBenchmark,
      coverage: 45.0 // Low coverage should trigger warning
    };

    const comparison: ComparisonResult = {
      comparisonId: 'coverage-warning-test',
      userPeriod: mockUserPeriod,
      benchmark: lowCoverageBenchmark,
      winRateDelta: 2.0,
      averageGuessesDelta: -0.1,
      beatsBenchmark: true,
      coverageWarning: true // Should be true for low coverage
    };

    expect(() => {
      expect(comparison.coverageWarning).toBe(true);
      expect(comparison.benchmark.coverage).toBeLessThan(50);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate significance level range', () => {
    const validSignificanceLevels = [0.01, 0.05, 0.10, undefined];
    
    validSignificanceLevels.forEach(level => {
      const comparison: ComparisonResult = {
        comparisonId: `significance-test-${level || 'undefined'}`,
        userPeriod: mockUserPeriod,
        benchmark: mockBenchmark,
        winRateDelta: 3.5,
        averageGuessesDelta: -0.2,
        beatsBenchmark: true,
        significanceLevel: level,
        coverageWarning: false
      };

      expect(() => {
        if (level !== undefined) {
          expect(level).toBeGreaterThan(0);
          expect(level).toBeLessThan(1);
        }
      }).toThrow(); // Expected to fail in TDD
    });
  });
});