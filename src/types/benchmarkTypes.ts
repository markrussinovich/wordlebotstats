// Benchmark data types for national averages and WordleBot comparisons

export type BenchmarkSource = 'national' | 'wordlebot';

export interface BenchmarkData {
  benchmarkId?: string;
  source: BenchmarkSource;
  puzzleNumber?: number; // Specific puzzle for WordleBot, undefined for aggregated periods
  periodStart?: string; // ISO 8601 format for aggregated benchmarks
  periodEnd?: string; // ISO 8601 format for aggregated benchmarks
  winRate: number; // 0-100
  averageGuesses: number;
  guessDistribution: number[]; // [1,2,3,4,5,6,fail] - percentages for benchmarks
  sampleSize: number; // Number of games in benchmark dataset
  lastUpdated: string; // ISO 8601 format
  coverage: number; // 0-100, percentage of date range covered by this benchmark
  timeFrame?: TimeFrame;
  stats?: BenchmarkStats;
}

export interface BenchmarkStats {
  winRate: number;
  averageGuesses: number;
  guessDistribution?: number[];
  sampleSize?: number;
  coverage?: number;
}

// Time frame options for statistics requests
export type TimeFrame = '7d' | '30d' | '90d' | 'ytd' | 'all';

// Grouping options for detailed statistics
export type GroupBy = 'day' | 'week' | 'month';

// Data export/import formats
export type DataFormat = 'json' | 'csv' | 'wordle-archive';

// Merge strategies for data import
export type MergeStrategy = 'replace' | 'merge' | 'skip-duplicates';