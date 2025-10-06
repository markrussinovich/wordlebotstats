# URGENT: Extension Source Files Are Out of Sync

## Problem

The `/dist/` directory contains working code with many bug fixes that are NOT in the `/src/extension/` TypeScript source files. The dist files have been hand-edited and contain vanilla JavaScript implementations that don't match the TypeScript sources.

## Current State

### Working files in `/dist/` (hand-edited, has all bug fixes):
- `dist/background.js` - Mix of compiled TS + hand-written vanilla JS
- `dist/popup.js` - Pure vanilla JS (now copied from src)  
- `dist/popup.html` - HTML with inline CSS (now copied from src)
- `dist/wordleBotContent.js` - Compiled from TS but may have hand edits

### Source files in `/src/extension/` (outdated, missing bug fixes):
- `src/extension/background/background.ts` - OLD TypeScript, missing many fixes
- `src/extension/content/wordleBotContent.ts` - May be missing scraper fixes
- `src/extension/popup/popup.js` - ✅ NOW IN SYNC (copied from dist)
- `src/extension/popup/popup.html` - ✅ NOW IN SYNC (copied from dist)

## What Happens Now

### Good News ✅
The build script (`quick-build-extension.js`) now properly copies popup files:
```bash
node quick-build-extension.js
```
This will:
- Compile TypeScript files
- Copy popup.html from src → dist
- Copy popup.js from src → dist

### Bad News ❌  
The TypeScript files in `/src/extension/background/` and `/src/extension/content/` are missing all the bug fixes we made to the dist files. If you rebuild, you'll lose all the fixes!

## Critical Bug Fixes That Need To Be Ported

### background.ts needs these fixes:
1. **Deduplication function** - Auto-removes duplicate games from storage
2. **Fixed date filtering** - Uses midnight (00:00:00) for date-only comparison
3. **Message forwarding fixes** - Returns `{received: true}` to prevent channel closed errors
4. **Always reload stats** - Even when 0 new games imported
5. **Improved logging** - Shows duplicate detection and date filtering details

### wordleBotContent.ts needs these fixes:
1. **Duplicate detection in scraper** - Checks date+solution before adding to scraped array
2. **Fixed date parsing** - Handles "Month Day" format (e.g., "September 24") 
3. **Year inference logic** - Uses current year or previous year if date is future
4. **stopAtDate logic** - Reads from storage params and stops when reached

## Recommended Action Plan

### Option 1: Keep using dist files (temporary)
- Continue editing `/dist/` files directly for quick fixes
- Document all changes carefully
- Risk: Changes lost if someone runs build script

### Option 2: Port fixes to TypeScript (proper solution)
1. Read all the working logic from `dist/background.js`
2. Rewrite it in TypeScript in `src/extension/background/background.ts`
3. Read working scraper from `dist/wordleBotContent.js`
4. Port fixes to `src/extension/content/wordleBotContent.ts`
5. Test that compiled output matches working dist files
6. Document the proper workflow

### Option 3: Keep dist as vanilla JS (hybrid approach)
- Convert background.ts to background.js (vanilla JS source file)
- Convert wordleBotContent.ts to wordleBotContent.js (vanilla JS source file)
- Update build script to copy these instead of compiling
- Lose TypeScript benefits but maintain working code

## Current Workflow (TEMPORARY)

**DO NOT RUN THE BUILD SCRIPT** until TypeScript sources are updated!

If you need to make changes:
1. Edit files in `/dist/` directly  
2. Test the extension
3. Manually document changes
4. Plan to port to TypeScript sources later

## Files Status Summary

| File | Source Location | Status | Notes |
|------|----------------|--------|-------|
| popup.html | src/extension/popup/ | ✅ SYNCED | Copied to dist by build script |
| popup.js | src/extension/popup/ | ✅ SYNCED | Copied to dist by build script |
| manifest.json | src/extension/ | ✅ SYNCED | Copied to dist by build script |
| background.js | dist/ ONLY | ❌ OUT OF SYNC | Has fixes not in background.ts |
| wordleBotContent.js | dist/ ONLY | ❌ OUT OF SYNC | Has fixes not in wordleBotContent.ts |
| content.js | dist/ | ⚠️  UNKNOWN | Compiled from wordleContent.ts, may be OK |

## Next Steps

Decide on approach and either:
- Port all fixes to TypeScript sources (recommended but time-consuming)
- OR document dist as canonical source and update workflow
- OR convert to vanilla JS everywhere
