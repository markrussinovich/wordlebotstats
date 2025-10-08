# How to Apply the Timeline Chart Fixes

## ✅ Changes Confirmed in Source Code

The following files have been successfully updated:

1. **src/components/charts/TimelineChart.tsx** - Lines 64-108
   - Added date gap filling logic
   - Fills ALL dates between first and last game
   - Missing dates show as grey "Unplayed" dots

2. **src/extension/content/wordleBotContent.ts** - Lines 374-460  
   - Lost game detection working correctly
   - Detects dash characters (-, —, –)
   - Sets `won: false` for lost games

## 🔧 Build & Reload Steps

### Step 1: Clean Build
Run these commands in PowerShell from the project directory:

```powershell
# Clean the dist directory
Remove-Item -Recurse -Force dist
New-Item -ItemType Directory -Path dist

# Build the extension
node quick-build-extension.js
```

OR use npm:
```powershell
npm run build:extension
```

### Step 2: Reload Extension in Browser

1. Open Chrome/Edge
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Find "Wordle Stats Extension"
4. Click the **RELOAD** button (circular arrow icon)
5. Close and reopen any open extension tabs

### Step 3: Re-scrape Data (Important!)

The extension caches game data. You need to:

1. **Clear existing data:**
   - Open popup
   - Look for "Clear Data" or delete cached games

2. **Re-scrape from WordleBot:**
   - Go to https://www.nytimes.com/games/wordle/wordlebot
   - Open extension popup
   - Click "Scrape WordleBot" or refresh button
   - Wait for all games to load and be scraped

3. **View Dashboard:**
   - Click "View Dashboard" in popup
   - You should now see:
     * ✓ Lost games marked with "Failed ❌" (TIZZY on July 21, MODAL on July 17)
     * ✓ Missing dates filled in as grey "Unplayed" dots (Oct 2, etc.)
     * ✓ Continuous timeline with no visual gaps

## 🧪 Verify the Build

To confirm the build included your changes:

1. Check that `dist/dashboard.js` exists and was recently modified
2. File should be ~500KB+ (minified with all React code)
3. The file will be minified, so you won't see readable variable names

## ⚠️ Common Issues

**Issue: "I refreshed but don't see changes"**
- Solution: You must RELOAD the extension in chrome://extensions/, not just refresh the page
- Also clear browser cache (Ctrl+Shift+R) on the dashboard page

**Issue: "Lost games still showing as wins"**
- Solution: The data is cached. You must re-scrape from WordleBot
- The scraper will now correctly detect lost games

**Issue: "Oct 2 still missing from chart"**
- Solution: This is a display issue, not data issue
- Make sure you reloaded the extension AND cleared browser cache on dashboard

**Issue: "Build seems stuck"**
- Solution: The terminal output may not be showing. Check if dist/ folder has files
- Look for `dist/dashboard.js`, `dist/background.js`, etc.

## 📝 What to Expect

After completing all steps, your dashboard should show:

### Timeline Chart:
- **Green dots**: Won games (3-6 turns)
- **Red X with "Failed ❌"**: Lost games (TIZZY July 21, MODAL July 17)
- **Grey dots with "Unplayed"**: Days with no game OR missing data dates (Oct 2)
- **Blue running average line**: Calculated from won games only
- **No visual gaps**: Every day from first to last game is shown

### Tooltip on Hover:
- Date: "Oct 6" or "July 21"  
- Word: "TIZZY" (if available)
- Result: "Failed ❌" for losses, "Solved in 3" for wins, "Unplayed" for no game

## 🐛 If Still Not Working

1. Check browser console (F12) for errors
2. Verify source files have changes:
   ```powershell
   findstr /C:"while (currentDate <= endDate)" src\components\charts\TimelineChart.tsx
   ```
   Should return a match

3. Check if dashboard.js was actually rebuilt:
   ```powershell
   Get-ChildItem dist\dashboard.js | Select-Object LastWriteTime
   ```
   Should show recent timestamp

4. Try building individual components:
   ```powershell
   npm run build:dashboard
   npm run build:extension
   ```

5. Hard refresh the dashboard (Ctrl+Shift+Delete → Clear cache)
