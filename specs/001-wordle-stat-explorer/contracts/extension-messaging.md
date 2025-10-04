# Extension Messaging Contracts

## Background ↔ Content Script Messages

### ImportGameResult Message
**Direction**: Content Script → Background Script  
**Purpose**: Send newly detected game result from Wordle page to background for processing

```typescript
interface ImportGameResultMessage {
  type: 'IMPORT_GAME_RESULT';
  payload: {
    puzzleNumber: number;
    date: string; // ISO 8601
    won: boolean;
    attempts: number | null;
    hardMode: boolean;
    guessPattern: GuessResult[][];
    timeToComplete?: number;
  };
}

interface GuessResult {
  letter: string;
  status: 'correct' | 'present' | 'absent';
}
```

### ImportResponse Message
**Direction**: Background Script → Content Script
**Purpose**: Confirm successful import or report errors

```typescript
interface ImportResponseMessage {
  type: 'IMPORT_RESPONSE';
  payload: {
    success: boolean;
    gameId?: string;
    error?: string;
    duplicateDetected?: boolean;
  };
}
```

## Background ↔ Popup Messages

### GetQuickStats Message  
**Direction**: Popup → Background Script
**Purpose**: Request aggregated statistics for popup display

```typescript
interface GetQuickStatsMessage {
  type: 'GET_QUICK_STATS';
  payload: {
    timeFrame: '7d' | '30d' | '90d' | 'ytd' | 'all';
    includeBenchmarks: boolean;
  };
}
```

### QuickStatsResponse Message
**Direction**: Background Script → Popup  
**Purpose**: Provide pre-computed statistics for quick display

```typescript
interface QuickStatsResponse {
  type: 'QUICK_STATS_RESPONSE';
  payload: {
    userStats: {
      winRate: number;
      averageGuesses: number;
      currentStreak: number;
      gameCount: number;
      guessDistribution: number[];
    };
    benchmarks?: {
      national?: BenchmarkStats;
      wordleBot?: BenchmarkStats;
    };
    deltas?: {
      winRateDelta: number;
      averageGuessesDelta: number;
    };
    lastUpdated: string;
  };
}
```

## Background ↔ Dashboard Messages

### GetDetailedStats Message
**Direction**: Dashboard → Background Script  
**Purpose**: Request comprehensive statistics with filtering

```typescript
interface GetDetailedStatsMessage {
  type: 'GET_DETAILED_STATS';
  payload: {
    startDate?: string;
    endDate?: string;
    puzzleRange?: {
      start: number;
      end: number;
    };
    hardModeOnly?: boolean;
    groupBy: 'day' | 'week' | 'month';
    includeTrends: boolean;
  };
}
```

### DetailedStatsResponse Message  
**Direction**: Background Script → Dashboard
**Purpose**: Provide comprehensive analysis data

```typescript
interface DetailedStatsResponse {
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

interface TrendPoint {
  date: string;
  value: number;
  rollingAverage?: number;
}
```

## Data Export/Import Contracts

### ExportUserData Message
**Direction**: Dashboard → Background Script
**Purpose**: Request complete data export

```typescript
interface ExportUserDataMessage {
  type: 'EXPORT_USER_DATA';
  payload: {
    includePreferences: boolean;
    includeGameDetails: boolean;
    dateRange?: {
      start: string;
      end: string;
    };
    format: 'json' | 'csv';
  };
}
```

### ImportUserData Message  
**Direction**: Dashboard → Background Script
**Purpose**: Import data from external source

```typescript
interface ImportUserDataMessage {
  type: 'IMPORT_USER_DATA';
  payload: {
    data: string; // JSON or CSV content
    format: 'json' | 'csv' | 'wordle-archive';
    mergeStrategy: 'replace' | 'merge' | 'skip-duplicates';
    validateOnly: boolean;
  };
}
```

## Settings Management Contracts

### UpdatePreferences Message
**Direction**: Dashboard/Popup → Background Script  
**Purpose**: Update user preferences

```typescript
interface UpdatePreferencesMessage {
  type: 'UPDATE_PREFERENCES';
  payload: Partial<UserPreferences>;
}
```

### GetBenchmarkInfo Message
**Direction**: Dashboard → Background Script
**Purpose**: Request benchmark data metadata

```typescript
interface GetBenchmarkInfoMessage {
  type: 'GET_BENCHMARK_INFO';
  payload: {
    source: 'national' | 'wordlebot' | 'all';
  };
}
```

## Error Handling Contracts

### ErrorMessage
**Direction**: Background Script → Any Client
**Purpose**: Report errors with context

```typescript
interface ErrorMessage {
  type: 'ERROR';
  payload: {
    code: 'STORAGE_ERROR' | 'IMPORT_ERROR' | 'CALCULATION_ERROR' | 'NETWORK_ERROR';
    message: string;
    context?: Record<string, any>;
    recoverable: boolean;
  };
}
```

## Performance Contracts

### Request Caching
- All statistics requests include cache headers with TTL
- Background script maintains LRU cache for computed statistics  
- Cache invalidation on new game imports or preference changes

### Message Size Limits
- Individual messages must not exceed 1MB
- Large datasets split into paginated responses
- Streaming interface for real-time game imports during bulk processing

### Response Time SLAs
- Quick stats requests: <100ms (from cache)
- Detailed stats requests: <500ms
- Import operations: <1000ms per game
- Export operations: <2000ms for full dataset