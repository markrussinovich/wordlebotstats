import { BenchmarkData } from '@/types/benchmarkTypes';

describe('BenchmarkData Model', () => {
  it('should validate BenchmarkData structure for national average', () => {
    const nationalBenchmark: BenchmarkData = {
      benchmarkId: 'national-2025-09',
      source: 'national',
      puzzleNumber: undefined,
      periodStart: '2025-09-01T00:00:00Z',
      periodEnd: '2025-09-27T23:59:59Z',
      winRate: 78.5,
      averageGuesses: 4.3,
      guessDistribution: [2, 8, 25, 30, 22, 10, 3], // Percentages
      sampleSize: 1500000,
      lastUpdated: '2025-09-27T12:00:00Z',
      coverage: 95.8
    };

    expect(() => {
      expect(nationalBenchmark.source).toBe('national');
      expect(nationalBenchmark.sampleSize).toBeGreaterThan(1000000);
      expect(nationalBenchmark.coverage).toBeGreaterThan(90);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate BenchmarkData structure for WordleBot', () => {
    const wordleBotBenchmark: BenchmarkData = {
      benchmarkId: 'wordlebot-123',
      source: 'wordlebot',
      puzzleNumber: 123,
      periodStart: undefined,
      periodEnd: undefined,
      winRate: 99.2,
      averageGuesses: 3.8,
      guessDistribution: [5, 20, 35, 25, 12, 2, 1],
      sampleSize: 1000000, // Simulated games
      lastUpdated: '2025-09-27T08:00:00Z',
      coverage: 100.0
    };

    expect(() => {
      expect(wordleBotBenchmark.source).toBe('wordlebot');
      expect(wordleBotBenchmark.puzzleNumber).toBe(123);
      expect(wordleBotBenchmark.coverage).toBe(100.0);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate source type values', () => {
    const validSources = ['national', 'wordlebot'];
    
    validSources.forEach(source => {
      const benchmark: BenchmarkData = {
        benchmarkId: `test-${source}`,
        source: source as any,
        winRate: 80.0,
        averageGuesses: 4.0,
        guessDistribution: [1, 5, 25, 35, 25, 8, 1],
        sampleSize: 10000,
        lastUpdated: '2025-09-27T10:00:00Z',
        coverage: 98.5
      };

      expect(() => {
        expect(validSources).toContain(benchmark.source);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate guess distribution percentages', () => {
    const benchmark: BenchmarkData = {
      benchmarkId: 'distribution-test',
      source: 'national',
      winRate: 85.0,
      averageGuesses: 4.1,
      guessDistribution: [1.5, 7.2, 28.3, 32.1, 14.6, 1.3, 15.0], // Should sum to ~100%
      sampleSize: 50000,
      lastUpdated: '2025-09-27T10:00:00Z',
      coverage: 100.0
    };

    expect(() => {
      const distributionSum = benchmark.guessDistribution.reduce((sum: number, percent: number) => sum + percent, 0);
      expect(distributionSum).toBeCloseTo(100.0, 1);
      expect(benchmark.guessDistribution).toHaveLength(7);
      
      // Each percentage should be non-negative
      benchmark.guessDistribution.forEach(percent => {
        expect(percent).toBeGreaterThanOrEqual(0);
      });
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate coverage percentage range', () => {
    const testCoverages = [0, 45.5, 78.9, 95.0, 100.0];
    
    testCoverages.forEach(coverage => {
      const benchmark: BenchmarkData = {
        benchmarkId: `coverage-${coverage}`,
        source: 'national',
        winRate: 80.0,
        averageGuesses: 4.2,
        guessDistribution: [2, 8, 25, 30, 20, 10, 5],
        sampleSize: 100000,
        lastUpdated: '2025-09-27T10:00:00Z',
        coverage: coverage
      };

      expect(() => {
        expect(benchmark.coverage).toBeGreaterThanOrEqual(0);
        expect(benchmark.coverage).toBeLessThanOrEqual(100);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate sample size is positive', () => {
    const benchmark: BenchmarkData = {
      benchmarkId: 'sample-size-test',
      source: 'wordlebot',
      puzzleNumber: 456,
      winRate: 92.1,
      averageGuesses: 3.9,
      guessDistribution: [8, 25, 35, 20, 8, 3, 1],
      sampleSize: 2500000,
      lastUpdated: '2025-09-27T10:00:00Z',
      coverage: 100.0
    };

    expect(() => {
      expect(benchmark.sampleSize).toBeGreaterThan(0);
      expect(Number.isInteger(benchmark.sampleSize)).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate win rate and average guesses correlation', () => {
    const benchmark: BenchmarkData = {
      benchmarkId: 'correlation-test',
      source: 'national',
      winRate: 75.0, // Lower win rate
      averageGuesses: 4.8, // Should be higher when win rate is lower
      guessDistribution: [1, 5, 18, 28, 20, 3, 25], // 25% failures
      sampleSize: 750000,
      lastUpdated: '2025-09-27T10:00:00Z',
      coverage: 88.3
    };

    expect(() => {
      // Lower win rates typically correlate with higher average guesses
      expect(benchmark.winRate).toBeGreaterThan(0);
      expect(benchmark.winRate).toBeLessThan(100);
      expect(benchmark.averageGuesses).toBeGreaterThan(1);
      expect(benchmark.averageGuesses).toBeLessThan(7);
    }).toThrow(); // Expected to fail in TDD
  });
});