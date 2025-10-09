// Extension messaging types for communication between background, popup, content, and dashboard

import { 
  GameResult, 
  StatisticsPeriod, 
  ComparisonResult, 
  UserPreferences 
} from './gameTypes';
import { 
  BenchmarkData, 
  BenchmarkStats, 
  TimeFrame, 
  GroupBy, 
  DataFormat, 
  MergeStrategy 
} from './benchmarkTypes';

// Re-export GuessResult for messaging contracts
export type { GuessResult } from './gameTypes';

// Message type enumeration
export enum MessageType {
  IMPORT_GAME_RESULT = 'IMPORT_GAME_RESULT',
  GET_QUICK_STATS = 'GET_QUICK_STATS',
  GET_DASHBOARD_DATA = 'GET_DASHBOARD_DATA',
  SYNC_DATA = 'SYNC_DATA',
  EXPORT_DATA = 'EXPORT_DATA',
  CLEAR_DATA = 'CLEAR_DATA',
  UPDATE_PREFERENCES = 'UPDATE_PREFERENCES',
  IMPORT_RESPONSE = 'IMPORT_RESPONSE',
  QUICK_STATS_RESPONSE = 'QUICK_STATS_RESPONSE',
  ERROR = 'ERROR',
  OPEN_DASHBOARD_TAB = 'OPEN_DASHBOARD_TAB',
  
  // WordleBot scraper messages
  START_WORDLE_BOT_SCRAPE = 'START_WORDLE_BOT_SCRAPE',
  WORDLE_BOT_SCRAPE_PROGRESS = 'WORDLE_BOT_SCRAPE_PROGRESS',
  WORDLE_BOT_SCRAPE_COMPLETE = 'WORDLE_BOT_SCRAPE_COMPLETE',
  WORDLE_BOT_SCRAPE_ERROR = 'WORDLE_BOT_SCRAPE_ERROR',
  GET_WORDLE_BOT_SCRAPE_STATUS = 'GET_WORDLE_BOT_SCRAPE_STATUS',
  WORDLE_BOT_SCRAPE_STATUS_UPDATED = 'WORDLE_BOT_SCRAPE_STATUS_UPDATED'
}

// Background ↔ Content Script Messages

export interface ImportGameResultMessage {
  type: MessageType.IMPORT_GAME_RESULT;
  gameResult: GameResult;
  source: string;
  timestamp: number;
}

export interface ImportResponseMessage {
  type: 'IMPORT_RESPONSE';
  payload: {
    success: boolean;
    gameId?: string;
    error?: string;
    duplicateDetected?: boolean;
  };
}

// Background ↔ Popup Messages

export interface GetQuickStatsMessage {
  type: MessageType.GET_QUICK_STATS;
  timeFrame: TimeFrame;
  includeBenchmarks: boolean;
}

export interface QuickStatsResponse {
  success: boolean;
  statistics?: {
    winRate: number;
    averageGuesses: number;
    currentStreak: number;
    gameCount: number;
    maxStreak: number;
    winCount: number;
    guessDistribution?: number[];
  };
  error?: string;
  timeFrame?: TimeFrame;
}

export interface OpenDashboardTabMessage {
  type: MessageType.OPEN_DASHBOARD_TAB;
}

export interface OpenDashboardTabResponse {
  success: boolean;
  reused: boolean;
  tabId?: number;
  error?: string;
}

// Background ↔ Dashboard Messages

export interface GetDashboardDataMessage {
  type: MessageType.GET_DASHBOARD_DATA;
  timeFrames?: TimeFrame[];
}

export interface DashboardDataResponse {
  success: boolean;
  games: GameResult[];
  benchmarks: BenchmarkData[];
  preferences: UserPreferences;
  timeFrames: TimeFrame[];
}

export interface GetDetailedStatsMessage {
  type: 'GET_DETAILED_STATS';
  payload: {
    startDate?: string;
    endDate?: string;
    puzzleRange?: {
      start: number;
      end: number;
    };
    hardModeOnly?: boolean;
    groupBy: GroupBy;
    includeTrends: boolean;
  };
}

export interface TrendPoint {
  date: string;
  value: number;
  rollingAverage?: number;
}

export interface DetailedStatsResponse {
  type: 'DETAILED_STATS_RESPONSE';
  payload: {
    periods: StatisticsPeriod[];
    trends: {
      winRateTrend: TrendPoint[];
      averageGuessesTrend: TrendPoint[];
      streakTrend: TrendPoint[];
    };
    comparisons: ComparisonResult[];
    metadata: {
      totalGames: number;
      dateRange: [string, string];
      benchmarkCoverage: number;
    };
  };
}

// Data Export/Import Messages

export interface ExportUserDataMessage {
  type: 'EXPORT_USER_DATA';
  payload: {
    includePreferences: boolean;
    includeGameDetails: boolean;
    dateRange?: {
      start: string;
      end: string;
    };
    format: DataFormat;
  };
}

export interface ImportUserDataMessage {
  type: 'IMPORT_USER_DATA';
  payload: {
    data: string; // JSON or CSV content
    format: DataFormat;
    mergeStrategy: MergeStrategy;
    validateOnly: boolean;
  };
}

// Settings Management Messages

export interface UpdatePreferencesMessage {
  type: 'UPDATE_PREFERENCES';
  payload: Partial<UserPreferences>;
}

export interface GetBenchmarkInfoMessage {
  type: 'GET_BENCHMARK_INFO';
  payload: {
    source: 'national' | 'wordlebot' | 'all';
  };
}

// Error Handling

export interface ErrorMessage {
  type: 'ERROR';
  payload: {
    code: 'STORAGE_ERROR' | 'IMPORT_ERROR' | 'CALCULATION_ERROR' | 'NETWORK_ERROR';
    message: string;
    context?: Record<string, any>;
    recoverable: boolean;
  };
}

// WordleBot Scraper Messages

export interface StartWordleBotScrapeMessage {
  type: MessageType.START_WORDLE_BOT_SCRAPE;
  mode: 'full' | 'incremental' | 'auto';
  stopAtDate?: string; // For incremental updates
  maxIterations?: number; // Safety limit for pagination
}

export interface WordleBotScrapeProgressMessage {
  type: MessageType.WORDLE_BOT_SCRAPE_PROGRESS;
  gamesFound: number;
  gamesProcessed: number;
  duplicatesSkipped: number;
  currentDate?: string;
  status: string;
}

export interface WordleBotScrapeCompleteMessage {
  type: MessageType.WORDLE_BOT_SCRAPE_COMPLETE;
  totalGames: number;
  newGames: number;
  duplicates: number;
  errors: number;
  dateRange?: {
    oldest: string;
    newest: string;
  };
}

export interface WordleBotScrapeErrorMessage {
  type: MessageType.WORDLE_BOT_SCRAPE_ERROR;
  error: string;
  code: 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN';
  recoverable: boolean;
}

export type WordleBotScrapePhase = 'idle' | 'checking' | 'importing' | 'complete' | 'error';

export interface WordleBotScrapeStatusSnapshot {
  phase: WordleBotScrapePhase;
  gamesFound: number;
  gamesProcessed: number;
  newGames: number;
  duplicates: number;
  errors: number;
  lastUpdated: string;
  mode?: StartWordleBotScrapeMessage['mode'] | null;
  statusMessage?: string | null;
  error?: string | null;
  dateRange?: WordleBotScrapeCompleteMessage['dateRange'] | null;
}

export interface GetWordleBotScrapeStatusMessage {
  type: MessageType.GET_WORDLE_BOT_SCRAPE_STATUS;
}

export interface WordleBotScrapeStatusResponse {
  success: boolean;
  status: WordleBotScrapeStatusSnapshot;
}

export interface WordleBotScrapeStatusUpdatedMessage {
  type: MessageType.WORDLE_BOT_SCRAPE_STATUS_UPDATED;
  status: WordleBotScrapeStatusSnapshot;
}

// Union type for all messages
export type ExtensionMessage = 
  | ImportGameResultMessage
  | ImportResponseMessage
  | GetQuickStatsMessage
  | QuickStatsResponse
  | GetDetailedStatsMessage
  | DetailedStatsResponse
  | ExportUserDataMessage
  | ImportUserDataMessage
  | UpdatePreferencesMessage
  | GetBenchmarkInfoMessage
  | ErrorMessage
  | StartWordleBotScrapeMessage
  | WordleBotScrapeProgressMessage
  | WordleBotScrapeCompleteMessage
  | WordleBotScrapeErrorMessage
  | GetWordleBotScrapeStatusMessage
  | WordleBotScrapeStatusUpdatedMessage;

// Re-export types for convenience
export type {
  UserPreferences,
  StatisticsPeriod,
  ComparisonResult,
  BenchmarkData,
  BenchmarkStats,
  TimeFrame,
  GroupBy,
  DataFormat,
  MergeStrategy
};