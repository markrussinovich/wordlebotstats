# Wordle Extension Real Data Analysis

## Step-by-Step Investigation Process

### 1. Load the Extension
1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `C:\source\Wordle\dist` folder
6. The extension should now appear in your extensions list

### 2. Visit NY Times Wordle
1. Navigate to `https://www.nytimes.com/games/wordle`
2. Log in if needed to access your Wordle data
3. Open Chrome Developer Tools (F12)
4. Go to the Console tab

### 3. Run Data Analysis Commands

#### Command 1: Check All localStorage Keys
```javascript
window.checkCurrentWordleData()
```
This will show ALL localStorage keys related to Wordle and their contents.

#### Command 2: Analyze Real Data Extraction
```javascript
window.importRealWordleData()
```
This attempts to extract actual individual game records (not synthetic data).

#### Command 3: Test Extension Communication
```javascript
window.testBackgroundConnection()
```
This tests if the extension's background script is working.

#### Command 4: Check Stored Games
```javascript
window.checkStoredGames()
```
This shows what data is actually stored in the extension.

### 4. Expected Results

**If Individual Game Data Exists:**
- You'll see actual game records with real dates and results
- Extension will work with limited but real data

**If Only Aggregate Data Exists:**
- You'll see statistics like "gamesPlayed: X", "gamesWon: Y" 
- No individual game records available
- Extension will show "No individual game data available"

### 5. Analysis Questions to Answer

1. **What localStorage keys exist?** (from `checkCurrentWordleData()`)
2. **Are there individual game records?** (from `importRealWordleData()`)
3. **What's the date range of available data?** 
4. **How many real individual games are available?**
5. **What data structure does NY Times use for storage?**

### 6. Document Findings

Based on the console output, determine:
- Whether NY Times stores individual game history
- How far back individual records go
- Whether the extension can work with real data
- What limitations exist for historical analysis