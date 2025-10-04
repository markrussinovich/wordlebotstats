# Data Model: Wordle Stat Explorer

## Core Entities

### GameResult
**Purpose**: Represents a single completed Wordle game with all outcome data
**Attributes**:
- `gameId`: Unique identifier (puzzle number or date-based)
- `date`: Date the game was completed (ISO 8601 format)
- `puzzleNumber`: Official Wordle puzzle number
- `completed`: Boolean indicating if game was finished
- `won`: Boolean indicating successful guess
- `attempts`: Number of guesses used (1-6, or null if not completed)
- `hardMode`: Boolean indicating if Hard Mode was enabled
- `guessPattern`: Array of guess validation results (correct/present/absent per letter)
- `timeToComplete`: Duration in seconds (optional)
- `streakActive`: Boolean indicating if this game continued an active streak
- `importedAt`: Timestamp when data was imported into extension

**Relationships**:
- Links to StatisticsPeriod aggregates
- References BenchmarkData for comparisons

### StatisticsPeriod  
**Purpose**: Aggregated statistics for a specific time range or puzzle range
**Attributes**:
- `periodId`: Unique identifier for the period
- `startDate`: Beginning of period (inclusive)
- `endDate`: End of period (inclusive)
- `gameCount`: Number of games in period
- `winCount`: Number of successful games
- `winRate`: Percentage of games won (0-100)
- `averageGuesses`: Mean number of guesses for won games
- `guessDistribution`: Array of counts for each guess number [1,2,3,4,5,6,fail]
- `currentStreak`: Length of active win streak at period end
- `maxStreak`: Longest win streak within period
- `failRate`: Percentage of games failed (0-100)
- `hardModeGames`: Count of games played in Hard Mode

**Derived Metrics**:
- `totalAttempts`: Sum of all guess attempts across games
- `medianGuesses`: Middle value of guess distribution
- `perfectGames`: Count of 1-guess wins
- `lastGuessWins`: Count of 6-guess wins

### BenchmarkData
**Purpose**: External comparison data from national averages and WordleBot
**Attributes**:
- `benchmarkId`: Unique identifier
- `source`: Source type ('national' | 'wordlebot')
- `puzzleNumber`: Specific puzzle this benchmark covers (optional)
- `periodStart`: Start date for aggregated benchmarks
- `periodEnd`: End date for aggregated benchmarks  
- `winRate`: Benchmark win rate percentage
- `averageGuesses`: Benchmark average guesses
- `guessDistribution`: Benchmark guess distribution
- `sampleSize`: Number of games in benchmark dataset
- `lastUpdated`: When benchmark data was last refreshed
- `coverage`: Percentage of date range covered by this benchmark

### UserPreferences
**Purpose**: User configuration and personalization settings
**Attributes**:
- `userId`: Unique user identifier (local to extension)
- `theme`: UI theme preference ('light' | 'dark' | 'system')
- `defaultTimeFrame`: Default analysis period ('7d' | '30d' | '90d' | 'ytd' | 'all')
- `spoilerSafety`: Boolean for hiding unsolved puzzle details
- `anonymousContribution`: Boolean for sharing aggregated data
- `syncEnabled`: Boolean for cross-device data sync
- `notificationsEnabled`: Boolean for import prompts
- `accessibilityMode`: Enhanced accessibility features enabled
- `reducedMotion`: Respect system reduced motion preference
- `dataRetentionDays`: How long to keep historical data (optional)

### ComparisonResult
**Purpose**: Calculated differences between user stats and benchmarks
**Attributes**:
- `comparisonId`: Unique identifier
- `userPeriod`: Reference to user's StatisticsPeriod
- `benchmark`: Reference to BenchmarkData used
- `winRateDelta`: User win rate minus benchmark win rate
- `averageGuessesDelta`: User average minus benchmark average
- `beatsBenchmark`: Boolean indicating if user performs better overall
- `significanceLevel`: Statistical significance of differences (optional)
- `coverageWarning`: Flag if benchmark has incomplete coverage

## Data Relationships

```
GameResult (1:many) → StatisticsPeriod
StatisticsPeriod (1:many) → ComparisonResult  
BenchmarkData (1:many) → ComparisonResult
UserPreferences (1:1) → User Session
```

## Storage Strategy

### Local Storage (IndexedDB)
- **GameResults Table**: Individual game records with full detail
- **Statistics Cache**: Pre-computed StatisticsPeriod objects for common time frames
- **Benchmarks Table**: Cached national and WordleBot data with expiration

### Extension Storage API  
- **Preferences**: UserPreferences object synced across devices
- **Import State**: Last import timestamp and status
- **Cache Metadata**: Expiration times and version info

## Data Validation Rules

### GameResult Validation
- `date` must be valid ISO 8601 date
- `puzzleNumber` must be positive integer
- `attempts` must be 1-6 or null
- `won` must be false if `attempts` is null
- `guessPattern` length must match `attempts`

### Statistics Calculation Rules  
- Win rate calculated only from completed games
- Average guesses calculated only from won games
- Streak calculations respect chronological order
- Hard Mode stats calculated separately when mixed usage detected

## Privacy & Data Handling

### Personal Data Classification
- **Highly Sensitive**: Individual game guess patterns, timestamps
- **Moderately Sensitive**: Win/loss records, streak data
- **Low Sensitivity**: Aggregated statistics, preferences

### Export Format
```json
{
  "exportVersion": "1.0",
  "exportDate": "2025-09-27T12:00:00Z",
  "gameResults": [...],
  "preferences": {...},
  "statistics": [...]
}
```

### Anonymization Rules
- Remove exact timestamps for anonymous contribution
- Aggregate data to minimum 7-day periods
- Strip guess patterns and retain only win/loss outcomes
- Include only completed games in anonymous datasets