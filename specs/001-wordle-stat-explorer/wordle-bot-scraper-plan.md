# Wordle Bot History Scraper - Implementation Plan

## Overview

The NYTimes Wordle Bot page (https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html) provides per-game analysis including:
- Game date and puzzle number
- Solution word (e.g., "GOOEY", "FRITZ", "DALLY")
- Skill score (0-100)
- Luck score (0-100)
- Steps/guesses (1-6 or X for failed)
- Link to detailed analysis

Currently, the Wordle extension only captures games when they are played. This feature will allow users to **scrape their complete historical data** from the Wordle Bot page and store it locally.

## User Experience

### Initial Scrape (New User)
1. User opens extension dashboard
2. Sees "Import History" button with description: "Import your complete Wordle history from WordleBot"
3. Clicks button → Opens WordleBot page in new tab or side panel
4. Extension automatically:
   - Scrolls through the page
   - Clicks "Load More" repeatedly
   - Extracts game data
   - Shows progress: "Loaded 42 of ~200 games..."
5. When complete, shows summary: "✓ Imported 237 games from May 2022 to present"
6. User returns to dashboard to see full historical analysis

### Incremental Update (Existing User)
1. User clicks "Refresh from WordleBot" 
2. Extension notes newest game in local storage (e.g., Sept 26, 2025)
3. Scrapes only until it reaches Sept 26
4. Shows: "✓ Added 3 new games"

### Manual Control
- Start/Pause/Stop buttons for user control
- Option to scrape specific date ranges
- Ability to re-scrape if data quality is suspect

## Technical Architecture

### 1. Content Script: `wordleBotContent.ts`

**Purpose**: Runs on the Wordle Bot page to extract game data

**Key Responsibilities**:
- Detect when on Wordle Bot page
- Listen for scrape commands from extension
- Extract game data from DOM
- Handle pagination (Load More button)
- Report progress back to background

**Data Extraction Strategy**:

```typescript
interface WordleBotGameData {
  date: string;           // "2025-09-28"
  gameNumber: number;     // 1197
  solution: string;       // "GOOEY"
  won: boolean;           // true
  guesses: number;        // 3
  skillScore: number;     // 89
  luckScore: number;      // 58
  analysisUrl?: string;   // Link to detailed analysis
}
```

**Extraction Process**:
1. Find game card containers (likely `<article>` or `<div class="game-card">`)
2. For each card, extract:
   - Game word (5-letter word in caps)
   - Date (e.g., "September 28")
   - Skill score (number after "SKILL" label)
   - Luck score (number after "LUCK" label)
   - Steps (number after "STEPS" label)
3. Convert to normalized `GameResult` format
4. Validate data completeness

**Pagination Handling**:
```typescript
async function loadMoreGames(): Promise<boolean> {
  const loadMoreButton = findLoadMoreButton();
  if (!loadMoreButton || loadMoreButton.disabled) {
    return false; // No more games to load
  }
  
  const beforeCount = getVisibleGameCount();
  loadMoreButton.click();
  
  // Wait for new content to load
  await waitForNewGames(beforeCount);
  
  return true; // Successfully loaded more
}
```

**DOM Selectors** (to be determined from page analysis):
- Game cards: TBD (likely `.wordle-score-card` or similar)
- Game word: TBD
- Date: TBD
- Scores: TBD
- Load More button: TBD (contains "load more" text)

### 2. Background Service Updates: `background.ts`

**New Message Types**:

```typescript
enum MessageType {
  // ... existing types
  START_WORDLE_BOT_SCRAPE = 'START_WORDLE_BOT_SCRAPE',
  PAUSE_WORDLE_BOT_SCRAPE = 'PAUSE_WORDLE_BOT_SCRAPE',
  STOP_WORDLE_BOT_SCRAPE = 'STOP_WORDLE_BOT_SCRAPE',
  WORDLE_BOT_SCRAPE_PROGRESS = 'WORDLE_BOT_SCRAPE_PROGRESS',
  WORDLE_BOT_SCRAPE_COMPLETE = 'WORDLE_BOT_SCRAPE_COMPLETE',
  WORDLE_BOT_SCRAPE_ERROR = 'WORDLE_BOT_SCRAPE_ERROR',
}

interface StartWordleBotScrapeMessage {
  type: MessageType.START_WORDLE_BOT_SCRAPE;
  options: {
    mode: 'full' | 'incremental';
    stopAtDate?: string; // For incremental updates
    maxGames?: number;   // Safety limit
  };
}

interface WordleBotScrapeProgressMessage {
  type: MessageType.WORDLE_BOT_SCRAPE_PROGRESS;
  progress: {
    gamesFound: number;
    gamesProcessed: number;
    duplicatesSkipped: number;
    currentDate: string;
    status: 'scanning' | 'loading' | 'processing' | 'paused';
  };
}
```

**Coordinator Logic**:
```typescript
async function handleStartWordleBotScrape(message: StartWordleBotScrapeMessage) {
  // 1. Determine newest game date in local storage
  const newestGame = await getNewestGame();
  const stopAtDate = message.options.mode === 'incremental' 
    ? newestGame?.date 
    : undefined;
  
  // 2. Open Wordle Bot page or inject into existing tab
  const tab = await openWordleBotPage();
  
  // 3. Send scrape command to content script
  await chrome.tabs.sendMessage(tab.id, {
    type: 'START_SCRAPE',
    stopAtDate,
    maxGames: message.options.maxGames || 1000
  });
  
  // 4. Listen for progress updates and save games as they arrive
}
```

### 3. Storage Service Updates: `storage.ts`

**New Methods**:

```typescript
class StorageService {
  /**
   * Save games in bulk with duplicate detection
   * @returns Number of new games saved
   */
  async bulkImportGames(games: GameResult[]): Promise<{
    imported: number;
    duplicates: number;
    errors: number;
  }> {
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    
    for (const game of games) {
      try {
        const exists = await this.getGame(game.date);
        
        if (exists) {
          // Merge logic: prefer data with more detail
          if (shouldReplaceExisting(exists, game)) {
            await this.saveGame(game);
            imported++;
          } else {
            duplicates++;
          }
        } else {
          await this.saveGame(game);
          imported++;
        }
      } catch (error) {
        console.error('Failed to import game:', error);
        errors++;
      }
    }
    
    return { imported, duplicates, errors };
  }
  
  /**
   * Get the newest game date in storage
   */
  async getNewestGame(): Promise<GameResult | null> {
    const games = await this.getAllGames();
    if (games.length === 0) return null;
    
    return games.reduce((newest, game) => {
      return new Date(game.date) > new Date(newest.date) ? game : newest;
    });
  }
  
  /**
   * Get scraper metadata (last scrape time, game count, etc.)
   */
  async getScraperMetadata(): Promise<ScraperMetadata> {
    return await this.getMetadata('wordleBotScraper') || {
      lastScrape: null,
      totalScraped: 0,
      lastError: null
    };
  }
}
```

**Merge Strategy**:
When a game already exists, prefer the version with more data:
- WordleBot data includes skill/luck scores → Keep it
- Manual entry has duration → Keep manual data
- Use timestamps to determine which is newer

### 4. UI Components

#### A. Dashboard: Import History Button

Location: `src/dashboard/pages/DataManagementPage.tsx`

```tsx
<Card>
  <CardHeader>
    <h2>Import from WordleBot</h2>
  </CardHeader>
  <CardBody>
    <p>
      Import your complete Wordle history including skill and luck scores 
      from the NYTimes WordleBot page.
    </p>
    
    <div className="mt-4 space-y-2">
      <Button 
        onClick={handleStartFullScrape}
        disabled={isScraping}
      >
        {hasGames ? 'Re-import All Games' : 'Import History'}
      </Button>
      
      {hasGames && (
        <Button 
          variant="secondary"
          onClick={handleIncrementalUpdate}
          disabled={isScraping}
        >
          Update with New Games
        </Button>
      )}
    </div>
    
    {scraperMetadata.lastScrape && (
      <p className="text-sm text-gray-600 mt-2">
        Last import: {formatDate(scraperMetadata.lastScrape)}
        ({scraperMetadata.totalScraped} games)
      </p>
    )}
  </CardBody>
</Card>
```

#### B. Scraper Progress Modal

```tsx
<Modal open={isScraping} onClose={handleCancel}>
  <ModalHeader>
    Importing from WordleBot
  </ModalHeader>
  <ModalBody>
    <div className="space-y-4">
      {/* Progress bar */}
      <ProgressBar 
        value={progress.gamesProcessed} 
        max={progress.gamesFound || 100}
      />
      
      {/* Status */}
      <div className="text-center">
        <p className="text-lg font-semibold">
          {progress.gamesProcessed} of {progress.gamesFound || '?'} games
        </p>
        <p className="text-sm text-gray-600">
          {progress.status === 'scanning' && 'Scanning page...'}
          {progress.status === 'loading' && 'Loading more games...'}
          {progress.status === 'processing' && 'Processing games...'}
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">New games:</span>
          <span className="ml-2 font-semibold">{progress.gamesProcessed - progress.duplicatesSkipped}</span>
        </div>
        <div>
          <span className="text-gray-600">Duplicates:</span>
          <span className="ml-2 font-semibold">{progress.duplicatesSkipped}</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handlePause} variant="secondary">
          {progress.status === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <Button onClick={handleCancel} variant="danger">
          Cancel
        </Button>
      </div>
    </div>
  </ModalBody>
</Modal>
```

### 5. Data Model Updates

**Extend GameResult**:

```typescript
interface GameResult {
  // ... existing fields
  
  // WordleBot-specific data
  skillScore?: number;      // 0-100
  luckScore?: number;       // 0-100
  analysisUrl?: string;     // Link to detailed WordleBot analysis
  
  // Enhanced metadata
  solution?: string;        // The answer word
  scrapedFrom?: 'wordle-bot' | 'manual' | 'live-capture';
}
```

**Validation**:
- Skill/luck scores must be 0-100
- Solution must be 5 letters (for standard Wordle)
- Date must match puzzle number if both present

### 6. Manifest Updates

**Add Host Permission**:

```json
{
  "host_permissions": [
    "https://www.nytimes.com/games/wordle*",
    "https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html"
  ],
  
  "content_scripts": [
    {
      "matches": ["https://www.nytimes.com/games/wordle*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html"],
      "js": ["wordleBotContent.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### 7. Rate Limiting & Ethics

**Respectful Scraping**:
- Add 500ms delay between "Load More" clicks
- Limit to 1000 games per session (safety)
- Clear progress indicator so user knows what's happening
- Allow user to cancel at any time
- Don't scrape in background without user knowledge

**Error Handling**:
- Network errors: Retry 3 times with exponential backoff
- Page structure changes: Fail gracefully with helpful error
- Authentication issues: Prompt user to log in to NYTimes
- Partial failures: Save what we got, allow resume

**Rate Limiting**:
```typescript
const RATE_LIMIT = {
  delayBetweenClicks: 500,        // ms
  delayBetweenPages: 1000,        // ms
  maxConsecutiveErrors: 5,
  backoffMultiplier: 2
};
```

## Implementation Phases

### Phase 1: Research & Prototyping (Current)
- ✅ Create page analysis script
- ⏳ Run analysis on actual Wordle Bot page
- ⏳ Identify exact DOM selectors
- ⏳ Test extraction with console script
- ⏳ Verify pagination mechanism

### Phase 2: Core Scraper (Week 1)
1. Create `wordleBotContent.ts` content script
2. Implement game card detection and extraction
3. Implement pagination handling
4. Test extraction accuracy with sample data
5. Add progress reporting

### Phase 3: Integration (Week 1-2)
1. Update background service with scraper messages
2. Implement bulk import in storage service
3. Add duplicate detection and merge logic
4. Test incremental updates

### Phase 4: UI (Week 2)
1. Add Import History button to dashboard
2. Create progress modal component
3. Add scraper status to Data Management page
4. Implement cancel/pause functionality
5. Add success/error notifications

### Phase 5: Polish & Testing (Week 3)
1. Add rate limiting and delays
2. Implement error handling and retries
3. Test with various account states (free vs paid)
4. Test edge cases (no games, interrupted scrapes)
5. Performance testing with large datasets

### Phase 6: Documentation (Week 3)
1. User guide with screenshots
2. Technical documentation
3. Troubleshooting guide
4. Privacy policy updates

## Testing Plan

### Unit Tests
- [ ] Game data extraction from mock DOM
- [ ] Date parsing and normalization
- [ ] Duplicate detection logic
- [ ] Merge strategy for conflicting data

### Integration Tests
- [ ] Content script → Background messaging
- [ ] Background → Storage bulk import
- [ ] Progress updates flow correctly
- [ ] Cancellation stops scraping

### E2E Tests
- [ ] Full scrape of sample page
- [ ] Incremental update scenario
- [ ] Interrupted scrape resume
- [ ] Error recovery

### Manual Testing Scenarios
1. **First-time user**: No existing data, scrape all
2. **Regular user**: Has data, update with new games
3. **Premium subscriber**: Access to full history
4. **Free user**: Limited history available
5. **Network issues**: Slow connection, timeouts
6. **Page changes**: NYTimes updates page structure

## Success Criteria

- [ ] Successfully scrape at least 90% of available games
- [ ] Correctly parse skill, luck, and steps from each game
- [ ] Incremental updates fetch only new games
- [ ] Scraping completes in reasonable time (< 5 min for 200 games)
- [ ] No data loss during interrupted scrapes
- [ ] Clear error messages for common issues
- [ ] User can cancel/pause at any time
- [ ] Respects rate limits and doesn't abuse NYTimes servers

## Open Questions

1. **Authentication**: Does scraping require NYTimes subscription?
2. **History limit**: How far back does WordleBot data go?
3. **Page structure**: Is it static HTML or dynamically loaded?
4. **API availability**: Is there a hidden API we can use instead?
5. **Legal/TOS**: Does this violate NYTimes terms of service?

## Next Steps

1. Run `analyze-wordle-bot-page.js` on actual page
2. Document exact DOM structure
3. Create proof-of-concept extractor
4. Test with real data
5. Begin implementation of Phase 2

---

**Last Updated**: September 29, 2025
**Status**: Planning Phase
**Owner**: Development Team
