# Debug: Popup Shows 0 Stats, No Scraping

## Symptoms
- Popup shows "Loading..." briefly
- Then shows 0 for all stats
- No scraping activity (no progress messages)

## Debugging Steps

### Step 1: Check if games exist in storage

1. Open extension popup
2. Press F12 to open DevTools for the popup
3. In the Console tab, run:
```javascript
chrome.storage.local.get(['games'], (result) => {
  const games = result.games || [];
  console.log(`Total games in storage: ${games.length}`);
  if (games.length > 0) {
    console.log('Sample games:', games.slice(0, 3));
    console.log('Newest game:', games.reduce((newest, game) => {
      return new Date(game.date) > new Date(newest.date) ? game : newest;
    }));
  }
});
```

**Expected outcomes:**
- **If 0 games:** Auto-import should have triggered. Check Step 2.
- **If games exist:** They might be filtered out. Check Step 3.

### Step 2: Check if auto-import was triggered

Look in the popup console for these logs:
```
[Popup] Found 0 games in storage
[Popup] No games found, triggering auto-import
[Popup] Triggering auto-import from WordleBot
[Popup] Auto-import response: {...}
```

**If you don't see "triggering auto-import":**
- Storage has games (go to Step 1)

**If you see "Auto-import response: undefined":**
- Background script didn't respond properly (go to Step 4)

**If you see "Scraping skipped or failed":**
- Check the reason in the logs

### Step 3: Check date filtering

If games exist but stats show 0, the issue is date filtering:

```javascript
// Check current date vs game dates
chrome.storage.local.get(['games'], (result) => {
  const games = result.games || [];
  const now = new Date();
  const cutoff7d = new Date();
  cutoff7d.setDate(now.getDate() - 7);
  
  console.log('Current date:', now.toISOString());
  console.log('7-day cutoff:', cutoff7d.toISOString());
  console.log('Games within 7 days:', games.filter(g => new Date(g.date) >= cutoff7d).length);
  
  games.forEach(g => {
    const gameDate = new Date(g.date);
    console.log(`Game ${g.gameNumber}: ${g.date} (${gameDate >= cutoff7d ? 'INCLUDED' : 'FILTERED OUT'})`);
  });
});
```

### Step 4: Check background script

1. Navigate to `chrome://extensions`
2. Find "Wordle Stats" extension
3. Click "service worker" link to open background script console
4. Look for these logs when opening popup:
```
[BACKGROUND DEBUG] Received message: START_WORDLE_BOT_SCRAPE
[BACKGROUND DEBUG] Starting WordleBot scrape (mode: auto)
[BACKGROUND DEBUG] Opened WordleBot tab: <tabId>
[BACKGROUND DEBUG] Sending response: {success: true, ...}
```

**If you don't see these logs:**
- Popup isn't sending the message (go back to Step 2)

**If you see error logs:**
- Background script is failing (check the error)

### Step 5: Check if WordleBot tab opens

After triggering scrape:
1. Look for a new tab with URL: `https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html`
2. If tab opens, open DevTools for that tab
3. Look for content script logs:
```
[WordleBotScraper] Initialized
[WordleBotScraper] Auto-starting scraper with params: {...}
[WordleBotScraper] Starting scraping (mode: auto)
```

## Common Issues

### Issue A: Games exist but are all old
**Symptom:** Storage has 94 games but stats show 0
**Cause:** All games are older than 7 days (current timeframe)
**Fix:** Click different timeframe buttons (30D, 90D, ALL) to see if stats appear

### Issue B: No response from background script
**Symptom:** `Auto-import response: undefined`
**Cause:** Background script message handler not returning response
**Fix:** Rebuild extension with fixed background script

### Issue C: Storage has games, no auto-import triggered
**Symptom:** Logs show "Games exist, skipping auto-import"
**Cause:** Working as designed - auto-import only runs when storage is empty
**Solution:** This is correct behavior. Check Issue A.

### Issue D: Tab doesn't open or content script doesn't load
**Symptom:** No WordleBot tab or no logs in that tab
**Cause:** Extension manifest or content script injection issue
**Fix:** Check manifest.json content_scripts configuration

## Quick Fix: Clear storage and retry

```javascript
// Run in popup console
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
  window.location.reload();
});
```

This will force auto-import on next popup open.
