// Core game and statistics types for Wordle Stat Explorer

// Time frame options for statistics requests
export type TimeFrame = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom';

// Basic benchmark data interface
export interface BenchmarkData {
  benchmarkId?: string;
  source: 'national' | 'wordlebot';
  winRate: number;
  averageGuesses: number;
  guessDistribution?: number[];
  sampleSize?: number;
  lastUpdated?: string;
  coverage?: number;
}

export interface GuessResult {
  letter: string;
  status: 'correct' | 'present' | 'absent';
}

export interface GameResult {
  gameId?: string;
  date: string; // ISO 8601 format
  puzzleNumber?: number;
  puzzle?: number;
  completed?: boolean;
  won: boolean;
  attempts: number | null; // null for failed games
  guesses?: number | null; // Alternative name for attempts
  hardMode: boolean;
  guessPattern?: GuessResult[][];
  timeToComplete?: number; // seconds
  duration?: number; // Alternative name for timeToComplete
  streakActive?: boolean;
  importedAt?: string; // ISO 8601 format
  time?: number | null;
  shareText?: string;
  source?: 'manual' | 'wordle-page' | 'csv-import' | 'share-import';
  maxGuesses?: number;
  wordLength?: number;
  gameNumber?: number;
  guessDistribution?: string[];
  solution?: string;
  metadata?: Record<string, any>;
  
  // WordleBot-specific fields
  skillScore?: number; // 0-100 rating from WordleBot
  luckScore?: number; // 0-100 rating from WordleBot
  analysisUrl?: string; // Link to detailed WordleBot analysis
  scrapedFrom?: 'wordle-bot' | 'manual' | 'live-capture'; // Source of the data
}

export interface StatisticsPeriod {
  periodId?: string;
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
  gameCount: number;
  winCount: number;
  winRate: number; // 0-100
  averageGuesses: number;
  guessDistribution: number[]; // [1,2,3,4,5,6,fail]
  currentStreak: number;
  maxStreak: number;
  failRate?: number; // 0-100
  hardModeGames?: number;
  
  // Derived metrics
  totalAttempts?: number;
  medianGuesses: number;
  perfectGames: number; // 1-guess wins
  lastGuessWins: number; // 6-guess wins
  
  // Additional properties used in models
  timeFrame?: TimeFrame;
  trends?: {
    direction: 'improving' | 'declining' | 'stable';
    strength: number;
  };
  games?: GameResult[];
}

export interface UserPreferences {
  userId?: string;
  theme: 'light' | 'dark' | 'system';
  defaultTimeFrame: TimeFrame;
  spoilerSafety?: boolean;
  anonymousContribution?: boolean;
  syncEnabled?: boolean;
  notificationsEnabled?: boolean;
  accessibilityMode?: boolean;
  reducedMotion?: boolean;
  dataRetentionDays?: number; // Optional retention period in days
  benchmarkSource?: BenchmarkSource;
  autoImport?: {
    enabled: boolean;
  };
  notifications?: {
    enabled?: boolean;
    dailyReminder: boolean;
    achievements: boolean;
    weeklyDigest: boolean;
    streakAlerts?: boolean;
    reminderTime?: string;
  };
}

export interface ComparisonResult {
  comparisonId?: string;
  userPeriod?: StatisticsPeriod;
  benchmarkStats?: BenchmarkData;
  winRateDelta: number; // user - benchmark
  averageGuessesDelta: number; // user - benchmark  
  beatsBenchmark?: boolean;
  significanceLevel?: number; // 0-1, statistical significance
  coverageWarning?: boolean; // true if benchmark has low coverage
  benchmarkSource?: string;
}

// BenchmarkSource type for store usage
export type BenchmarkSource = 'national' | 'wordlebot';