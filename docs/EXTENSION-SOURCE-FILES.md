# Extension Source Files Structure

This document tracks which extension files are source files vs build artifacts, and how to properly edit them.

## Source Files (Edit These)

### `/src/extension/popup/`
- **popup.html** - HTML template with inline CSS
- **popup.js** - Vanilla JavaScript popup logic (NOT compiled from TypeScript)
- ~~popup.tsx~~ - OLD React version, not currently used

### `/src/extension/background/`
- **background.ts** - TypeScript background service worker
- **extensionStorage.ts** - TypeScript storage wrapper

### `/src/extension/content/`
- **wordleBotContent.ts** - TypeScript WordleBot scraper content script
- **wordleContent.ts** - TypeScript Wordle.com content script

### `/src/extension/`
- **manifest.json** - Extension manifest

## Build Process

Run `node quick-build-extension.js` to build the extension:

1. **Compiles TypeScript files** to JavaScript:
   - `background.ts` → `dist/background.js` (ESM format for service worker)
   - `wordleBotContent.ts` → `dist/wordleBotContent.js` (IIFE format)
   - `wordleContent.ts` → `dist/content.js` (IIFE format)

2. **Copies static files** directly:
   - `popup.html` → `dist/popup.html`
   - `popup.js` → `dist/popup.js` (vanilla JS, not compiled)
   - `manifest.json` → `dist/manifest.json`

## Important Notes

### Popup Implementation
The popup currently uses **vanilla JavaScript** (popup.js), not React.
- popup.js is **copied** to dist, not compiled
- Edit `src/extension/popup/popup.js` as the source of truth
- The old React files (popup.tsx, PopupComponent.tsx) are not currently used

### Background Script
The background script is compiled from TypeScript:
- Edit `src/extension/background/background.ts`
- Run build script to update `dist/background.js`
- DO NOT edit `dist/background.js` directly

### Content Scripts
Both content scripts are compiled from TypeScript:
- Edit `src/extension/content/wordleBotContent.ts`
- Edit `src/extension/content/wordleContent.ts`  
- Run build script to update dist files
- DO NOT edit dist files directly

## Recent Fixes Applied (Oct 5, 2025)

### popup.js
- Auto-triggers scraping on popup open
- Shows progress messages during scraping
- Reloads stats after scraping completes
- Fixed height consistency between loading and stats states

### popup.html
- Loading state CSS: `padding: 65px 40px 85px` to match stats grid height
- Uses grid layout for consistent dimensions

### background.ts (compiled to background.js)
- Added automatic deduplication of games in storage
- Fixed date filtering to use midnight (00:00:00) for date-only comparison
- Added progress message forwarding (with proper async response handling)
- Fixed stats to always reload after scraping, even if 0 new games

### wordleBotContent.ts (compiled to wordleBotContent.js)
- Fixed duplicate detection within scraping session
- Checks date+solution combination before adding to scraped array
- Fixed date parsing for "Month Day" format (e.g., "September 24")
- Implements stopAtDate logic to avoid re-scraping old games

## Workflow

1. **Make changes** to source files in `/src/extension/`
2. **Run build**: `node quick-build-extension.js`
3. **Test extension** from `/dist/` directory in Chrome
4. **Never edit `/dist/` files directly** - they will be overwritten on next build
