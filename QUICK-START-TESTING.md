# 🚀 Quick Start - Testing Auto-Import

## Build & Load
```cmd
npm run build
```
Then load `dist/` folder in Chrome Extensions (Developer Mode)

## Test It!
1. **Make sure you're logged in to NYTimes** (any tab)
2. Click the extension icon
3. Watch for: "🔄 Checking for latest games..."
4. Background tab should open to WordleBot page
5. Wait 20-40 seconds
6. Tab auto-closes, you see "✓ Added X new games!"

## Check Console
- Popup Console: Right-click popup → Inspect
- Background Console: chrome://extensions/ → "service worker" link
- Look for `[WordleBotScraper]` and `[Background]` logs

## If Something Goes Wrong
- **No tab opens**: Check if cooldown is active (wait 4+ hours or check metadata)
- **Tab doesn't close**: Check background console for errors
- **No games found**: Verify you're logged in to NYTimes
- **Build errors**: Those are pre-existing (194 errors in other files), our code compiles clean!

## Check Storage
```javascript
// In background console
chrome.storage.local.get(['wordleBotScraper', 'gamesCache'], console.log)
```

## Success Looks Like
✅ Background tab opens and closes automatically  
✅ "✓ Added X new games!" message appears  
✅ Stats update with correct numbers  
✅ No console errors from our code  
✅ Second open within 4 hours skips import  

---

**Any issues? Share**:
1. Screenshots of popup states
2. Console logs (background + popup)
3. Number of games imported
4. Browser/OS version

Let's make this perfect! 🎯
