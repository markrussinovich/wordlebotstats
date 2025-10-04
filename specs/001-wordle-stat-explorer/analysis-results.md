# Wordle Bot Analysis Results

**Date**: September 29, 2025  
**URL**: https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html

## Initial Findings

### Page Structure

From the initial analysis, we discovered:

1. **Main Containers Found**:
   - `#g-wordle-results.wordle-results` - Main results container
   - `.past-scores-container` - Past scores container
   
2. **Game Elements**:
   - **82 elements** matching `div[class*="game"]`
   - First element found: `<div aria-hidden="true" class="rating-label value-label game-number svelte-3c5k3b">Game</div>`
   - This suggests the page uses **Svelte** framework (class names contain `svelte-*`)

3. **Score Elements**:
   - 1 element matching `div[class*="score"]` - likely the container
   - 1 element matching `div[class*="result"]` - the main wordle-results div

4. **No "Load More" Button Found**:
   - No buttons with "load", "more", or "show" text detected
   - **Implication**: The page likely uses:
     - Infinite scroll (loads as you scroll down)
     - OR all games are pre-loaded on page load
     - OR games are loaded via API after initial page render

## Key Technical Details

### Framework
- **Svelte**: The class names include `svelte-3c5k3b` pattern, indicating the page is built with Svelte
- This means:
  - Components are compiled to vanilla JavaScript
  - DOM structure is predictable and structured
  - Data might be embedded in the page on load

### Potential Selectors to Try

Based on the findings, these selectors should be tested next:

```javascript
// Container selectors
'#g-wordle-results'
'.past-scores-container'

// Individual game card selectors (to be tested)
'#g-wordle-results > div'
'.past-scores-container > div'
'[class*="past-score"]'
'[class*="score-card"]'
'[class*="game-row"]'
```

### Data Attributes
- The initial script errored on `[data-*]` selector (not valid CSS)
- Need to use `document.querySelectorAll('*')` and filter by attributes
- This is handled in the v2 script

## Next Steps

### Immediate Actions

1. **Run the v2 extractor script**:
   ```javascript
   // Copy and paste the contents of wordle-bot-extractor-v2.js
   // into the browser console on the Wordle Bot page
   ```

2. **Check the results**:
   ```javascript
   // After running v2 script:
   window.__WORDLE_EXTRACTOR__.summary          // See analysis summary
   window.__WORDLE_EXTRACTOR__.extractAllGames() // Extract all visible games
   ```

3. **Test scrolling** (if infinite scroll):
   ```javascript
   // Scroll to bottom to load more games
   window.scrollTo(0, document.body.scrollHeight);
   
   // Wait a moment, then check again
   setTimeout(() => {
     console.log('Games now:', document.querySelectorAll(window.__WORDLE_EXTRACTOR__.workingSelector).length);
   }, 2000);
   ```

### Investigation Tasks

- [ ] **Confirm game card selector**: What exact selector reliably gets all game cards?
- [ ] **Identify pagination mechanism**: Infinite scroll, load more, or all pre-loaded?
- [ ] **Extract sample game data**: Can we reliably extract word, date, scores from each card?
- [ ] **Check for API calls**: Monitor Network tab for any AJAX/fetch requests when scrolling
- [ ] **Find embedded data**: Look for `window.__INITIAL_STATE__` or similar global variables
- [ ] **Test authentication**: Do we need to be logged in to NYTimes to see full history?

## Expected Data Structure

Based on the screenshot provided, each game should have:

```javascript
{
  solution: "GOOEY",           // The 5-letter word
  date: "September 28",        // Date string
  gameNumber: 1197,            // Wordle puzzle number
  skillScore: 89,              // 0-100
  luckScore: 58,               // 0-100
  steps: 3,                    // Number of guesses (or 0 if X/failed)
  won: true,                   // Whether puzzle was solved
  analysisUrl: "..."           // Link to "View analysis"
}
```

## Questions to Answer

### 1. How many games are visible on page load?
- Initial finding: 82 elements with `class*="game"`
- Need to confirm these are actual game cards or just UI elements

### 2. Are all games loaded at once?
- No "Load More" button found
- Possible scenarios:
  - **A**: All games pre-rendered on page load (best case)
  - **B**: Games load as you scroll (infinite scroll)
  - **C**: Games load via JavaScript after page render

### 3. What's the maximum history available?
- Wordle started Feb 2022, so max ~1300+ games possible
- NYTimes may limit history to subscribers only
- Free users might see limited history (last 90 days?)

### 4. Do we need authentication?
- Is the user already logged in to NYTimes?
- Does the extension need to handle authentication?
- Can we detect if user needs to log in?

## Scraping Strategy Recommendations

### If All Games Pre-Loaded (Scenario A)
```typescript
// Simple one-time extraction
async function scrapeAllGames() {
  const cards = document.querySelectorAll(GAME_CARD_SELECTOR);
  const games = [];
  
  cards.forEach(card => {
    const game = extractGameFromCard(card);
    if (game) games.push(game);
  });
  
  return games;
}
```

### If Infinite Scroll (Scenario B)
```typescript
async function scrapeWithScroll() {
  const games = new Set();
  let previousCount = 0;
  let stableCount = 0;
  
  while (stableCount < 3) {
    // Extract currently visible games
    const currentGames = extractVisibleGames();
    currentGames.forEach(g => games.add(JSON.stringify(g)));
    
    // Scroll down
    window.scrollBy(0, 1000);
    await sleep(1000);
    
    // Check if new games appeared
    if (currentGames.length === previousCount) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    
    previousCount = currentGames.length;
  }
  
  return Array.from(games).map(JSON.parse);
}
```

### If API Available (Scenario C)
```typescript
// Intercept or call the API directly
async function scrapeViaAPI() {
  // Find the API endpoint from Network tab
  const response = await fetch('/api/wordle-bot/history', {
    credentials: 'include'
  });
  
  const data = await response.json();
  return data.games;
}
```

## Testing Checklist

Before implementing the content script, verify:

- [ ] Game cards are identifiable with a stable selector
- [ ] All required data (word, date, scores) can be extracted from each card
- [ ] Scrolling behavior is understood (if applicable)
- [ ] Page doesn't require special authentication beyond normal NYTimes login
- [ ] Data format is consistent across all games
- [ ] No rate limiting or anti-scraping measures detected

## Files Created

1. **scripts/analyze-wordle-bot-page.js** - Initial analysis script (fixed)
2. **scripts/wordle-bot-extractor-v2.js** - Enhanced extraction script (NEW)
3. **specs/001-wordle-stat-explorer/wordle-bot-scraper-plan.md** - Implementation plan
4. **This file** - Analysis results documentation

## Next Script to Run

Copy the entire contents of `scripts/wordle-bot-extractor-v2.js` and paste into the browser console on the Wordle Bot page. It will:

1. Find the game container
2. Identify game cards
3. Extract data from first 3 games as samples
4. Provide a `extractAllGames()` function to get all games
5. Give recommendations for scraping approach

---

**Status**: Awaiting v2 script results  
**Updated**: September 29, 2025
