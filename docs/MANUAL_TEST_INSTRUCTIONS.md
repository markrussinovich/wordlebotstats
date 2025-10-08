# Manual Extension Testing Instructions

Since automated testing triggers bot detection, let's test the extension manually:

## 🚀 Step 1: Load Extension into Edge

1. **Open Microsoft Edge** (your regular Edge browser)
2. **Go to**: `edge://extensions/` 
3. **Enable Developer mode** (toggle in bottom left)
4. **Click "Load unpacked"**
5. **Select folder**: `C:\source\Wordle\dist`
6. **Confirm extension loads** - you should see "Wordle Stat Explorer" in the list

## 🔐 Step 2: Login and Test

1. **Open new tab** and go to: `https://www.nytimes.com/games/wordle`
2. **Login** with your NY Times account
3. **Play or view a completed Wordle game**
4. **Open Browser DevTools** (F12) and check Console tab
5. **Look for extension messages** starting with 🎯 or 🎮

## 🧪 Step 3: Test Extension Functions

### Test Content Script:
In the Wordle page console, try:
```javascript
// Check if content script loaded
window.wordleExtensionDebug

// Check authentication status  
window.wordleExtensionDebug.checkAuth()

// Look for game elements
window.wordleExtensionDebug.findGameElements() 

// Force game detection
window.wordleExtensionDebug.forceDetection()

// Test import functionality
window.wordleExtensionDebug.testImport()
```

### Test Extension Popup:
1. **Click the extension icon** in the toolbar (puzzle piece icon)
2. **Click on Wordle Stat Explorer**
3. **Check what data is shown**
4. **Try clicking "View Dashboard"**

### Test Dashboard:
1. **From popup, click "View Dashboard"** OR
2. **Right-click extension → Options** OR  
3. **Go directly to**: `chrome-extension://[extension-id]/dashboard.html`

In dashboard console, try:
```javascript
// Check debug functions
window.debugWordle

// Check storage
await window.debugWordle.checkStorage()

// Add test game
await window.debugWordle.addTestGame()

// Reload data
await window.debugWordle.reloadData()
```

## 🔍 What to Look For

### ✅ Success Indicators:
- Console shows: "Wordle Stat Explorer content script loaded"
- Console shows: "Debug functions available"
- Extension popup shows stats (not "Loading...")
- Dashboard displays charts with data
- No authentication errors in console

### ❌ Problem Indicators:
- Console shows: "Game app not found"  
- Console shows: "not authenticated"
- Popup shows "Loading data..." indefinitely
- Dashboard shows "No data available"

## 📊 Report Back

Please let me know:
1. **Did the extension load successfully?**
2. **Are you able to login to Wordle normally?**
3. **What do you see in the browser console?**
4. **What does the extension popup show?**
5. **What does the dashboard display?**

This manual approach should avoid all bot detection issues and let us see exactly what's happening with the extension!