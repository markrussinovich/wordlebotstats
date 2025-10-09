# Contributing Guide

Thanks for your interest in improving the Wordle Bot Stats extension!

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or later recommended)
- **npm** (comes with Node.js)
- **Chrome** or **Edge** browser (for testing the extension)

## Project Overview
The extension scrapes the NYTimes Wordle Bot results page, imports structured game data, and computes statistics shown in a popup & dashboard. It is built with:
- Manifest V3 service worker (background)
- Content script scraper (`wordleBotContent.ts`)
- React 18+ with TypeScript
- Local persistence via `chrome.storage.local`
- Vite build pipeline
- Jest for unit tests
- Playwright for end-to-end tests

## Directory Layout
```
src/
  extension/
    background/      # Service worker + storage + message routing
    content/         # Scraper logic (DOM parsing, batching, progress)
    popup/           # React popup UI (user statistics)
    utils/           # Shared helpers (logger)
  stores/            # Zustand or similar state management
  services/          # Higher-level data / abstraction services
  models/            # Data shapes / domain models
  types/             # Shared TypeScript types
scripts/             # Dev & performance scripts
public/              # Static assets (icons, manifest, etc.)
```

## Build & Test Workflow

### Installing Dependencies

First, install all required dependencies (both runtime and development):

```bash
npm install
```

This will install:
- **Runtime dependencies**: React, Zustand, Recharts, date-fns, etc.
- **Development dependencies**: TypeScript, Vite, Jest, Playwright, ESLint, Prettier, and build tools

> **Windows PowerShell Note**: If you encounter execution policy errors, use `cmd.exe` instead:
> ```cmd
> cmd /c "npm install"
> ```

### Build Commands

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Build extension | `npm run build:quick` |
| Build (alternative) | `node scripts/quick-build-extension.js` |
| Development mode (dashboard) | `npm run dev` |

### Testing Commands

| Action | Command |
|--------|---------|
| Run unit tests | `npm test` |
| Run tests in watch mode | `npm run test:watch` |
| Run E2E tests | `npm run test:e2e` |
| Format code | `npm run format` |

### Loading the Extension

After building:
1. Open Chrome/Edge and navigate to `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project
5. The extension should now appear in your toolbar

## Debug Logging
Use the centralized logger (`src/extension/utils/logger.ts`). Avoid raw `console.*` for noisy flows.

Enable debug logs:
```
VITE_DEBUG_LOGS=true npm run build
```
Or at runtime in DevTools:
```js
WORDLE_ENABLE_DEBUG_LOGS();
WORDLE_DISABLE_DEBUG_LOGS();
```

## Adding / Modifying the Scraper
1. Keep DOM selectors localized near the scraper logic.
2. Prefer incremental extraction—avoid re-processing already parsed cards (see WeakSet caching).
3. Use `sendProgress` consistently: statuses `loading`, `ready`, `processing`, `processed`.
4. Keep per-batch size reasonable (currently 10) to avoid blocking the service worker.

## Performance Guidelines
- Avoid repeated full-array rewrites unless necessary.
- Strip large transient fields (e.g. board images) before persistence.
- Minimize arbitrary delays; document any required waits.

## Messaging Contracts
Messages live in `src/types/messagingTypes.ts`.
Changes affecting message shapes must:
- Update the type definitions
- Adjust background handlers
- Update popup listeners & formatting helpers

## Code Style
- TypeScript strictness preferred for new code.
- Use descriptive variable names (avoid single-letter except in tight loops).
- Keep functions small and purpose-driven.

## Submitting Changes
1. Create a feature branch: `feat/<short-description>`
2. Make focused commits (imperative mood: "Add scraper batch timing")
3. Run tests: `npm test`
4. Build and test the extension: `npm run build:quick`
5. Update README or CONTRIBUTING if behavior or workflows change
6. Open a PR with a clear summary & before/after notes

## Quick Checklist
- [ ] Feature documented (README or inline comments)
- [ ] No leftover debug artifacts (`temp_*.txt`, ad-hoc console overrides)
- [ ] Uses centralized logger where appropriate
- [ ] Respects existing messaging contracts
- [ ] Performance impact considered

## Need Help?
Open an issue describing:
- What you tried
- Expected vs actual behavior
- Relevant logs (enable debug logging if useful)

Happy hacking! 🎯
