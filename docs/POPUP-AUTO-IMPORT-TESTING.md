# Wordle Bot Auto-Import - Testing Guide

**Status**: ✅ Implementation Complete - Ready for Testing  
**Date**: September 30, 2025

## What Was Built

### Core Features
1. **Auto-Import from WordleBot**: Opens WordleBot page in background tab when popup opens
2. **Smart Cooldown**: Only runs every 4 hours to respect NYTimes servers
3. **Incremental Updates**: Only scrapes games newer than your latest game
4. **Progress Indicators**: Shows "Checking for latest games..." → "Importing X games..." → "✓ Added X new games!"
5. **Background Processing**: Tab opens in background, auto-closes when done

### Files Created/Modified

#### New Files
- `src/extension/content/wordleBotContent.ts` - TypeScript scraper content script

#### Modified Files
- `src/types/gameTypes.ts` - Added WordleBot fields (skillScore, luckScore, analysisUrl, scrapedFrom)
- `src/types/messagingTypes.ts` - Added scraper message types
- `src/services/storage.ts` - Added bulkImportGames(), getNewestGame(), getScraperMetadata()
- `src/extension/background/background.ts` - Added scraper handlers and tab management
- `src/extension/popup/PopupComponent.tsx` - Added auto-import UI and progress tracking
- `src/extension/manifest.json` - Added WordleBot permissions and content script
- `vite.config.ts` - Added wordleBotContent to build

## How to Test

### Build the Extension
```cmd
npm run build
```

### Load Extension in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

### Test Scenario 1: First Time User (Full Import)
**Expected**: Background import of all available games

1. Make sure you're **logged in to NYTimes** in Chrome
2. Have **no existing Wordle data** in extension
3. Click extension icon to open popup
4. **Watch for**:
   - "🔄 Checking for latest games..." (appears immediately)
   - Background tab opens to WordleBot page (NOT focused)
   - "📥 Importing X games..." (progress updates)
   - Background tab auto-closes after ~30 seconds
   - "✓ Added X new games!" (success message)
   - Stats appear with your actual data

**What to verify**:
- [ ] Background tab opened and closed automatically
- [ ] No errors in console (F12 → Console)
- [ ] Stats show correct numbers
- [ ] Badge shows current streak

### Test Scenario 2: Existing User (Incremental Update)
**Expected**: Only import games since last check

1. Close and reopen popup (simulates user opening extension later)
2. **Watch for**:
   - "🔄 Checking for latest games..."
   - If < 4 hours since last check: **No background tab opens** (cooldown)
   - If > 4 hours: Background tab opens, imports only new games

**What to verify**:
- [ ] Cooldown prevents unnecessary scraping
- [ ] Only new games are added (check dates)
- [ ] Duplicates are not created

### Test Scenario 3: No New Games
**Expected**: Quick check, no import needed

1. Wait 4+ hours after Test Scenario 2
2. Open popup
3. **Watch for**:
   - "🔄 Checking for latest games..."
   - "✓ Added 0 new games!" or immediate stats display

**What to verify**:
- [ ] No errors occur
- [ ] Stats still display correctly

### Test Scenario 4: Not Logged In to NYTimes
**Expected**: Error message with helpful guidance

1. Log out of NYTimes (or open in Incognito)
2. Open popup
3. **Watch for**:
   - "🔄 Checking for latest games..."
   - Error: "Import error: ..." (auth-related)
   - "Retry Import" button appears

**What to verify**:
- [ ] Clear error message
- [ ] Retry button works
- [ ] Extension doesn't crash

### Test Scenario 5: Network Error
**Expected**: Graceful error handling

1. Disconnect internet
2. Open popup
3. **Watch for**:
   - Timeout or network error message
   - Background tab closes gracefully

**What to verify**:
- [ ] No infinite loading state
- [ ] Clear error message
- [ ] Can retry when network returns

## Debugging Tools

### Chrome Extension Logs
```javascript
// Background service worker console
chrome://extensions/ → Click "service worker" link

// Popup console
Right-click popup → "Inspect"

// Check scraper metadata
chrome.storage.local.get(['wordleBotScraper'], console.log)

// Check cooldown status
chrome.storage.local.get(['lastScraperRun'], console.log)
```

### Manual Testing Commands
Open the WordleBot page manually and check console:

```javascript
// Verify scraper loaded
window.__wordleBotScraper

// Check game card detection
document.querySelectorAll('.rating-container.svelte-pnoxcy').length

// Check button availability
document.querySelector('.show-more-button.svelte-151vgtd')
```

## Known Limitations

1. **Requires NYTimes Login**: User must be logged in to NYTimes
2. **Background Tab Visible**: Tab appears in tab bar (but not focused)
3. **4-Hour Cooldown**: Can't manually trigger more frequent checks from popup
4. **Max 10 Pages**: Auto-import limits to 10 pagination clicks (~60 games) for speed

## Expected Behavior Summary

| State | UI Message | Background Tab | Duration |
|-------|-----------|----------------|----------|
| Initial Check | "🔄 Checking for latest games..." | Opens | 3-5 sec |
| Importing | "📥 Importing X games..." | Open, scraping | 20-40 sec |
| Complete | "✓ Added X new games!" | Auto-closed | 3 sec then shows stats |
| Cooldown | Immediate stats display | None | Instant |
| Error | "Import error: ..." | Auto-closed | Stays until retry |

## Troubleshooting

### "No games found"
- Check if logged in to NYTimes
- Verify WordleBot page loads manually
- Check browser console for errors

### "Background tab doesn't close"
- Check for JavaScript errors in service worker console
- Verify scraper completed (check console logs)

### "Duplicate games created"
- Check duplicate detection logic in storage service
- Verify dates match correctly

### "Cooldown not working"
- Check scraper metadata in chrome.storage
- Verify 4-hour calculation in background.ts

## Success Criteria

✅ All scenarios above pass without errors  
✅ Background tab auto-closes reliably  
✅ Stats update correctly after import  
✅ Cooldown prevents excessive scraping  
✅ Error messages are clear and helpful  
✅ No performance issues or memory leaks  

---

## Ready to Test!

**Start with Test Scenario 1** (First Time User) to see the full experience.

Once you've tested, let me know:
1. Which scenarios passed/failed
2. Any console errors
3. Any unexpected behavior
4. Whether the UX feels smooth

I'll fix any issues and we can iterate until it's perfect!
