# Wordle Bot Stats Extension

A Chrome (MV3) extension that automatically scrapes your NYTimes Wordle Bot game history, imports the results locally, and presents rich statistics via a popup and dashboard UI.

## Key Features
- Automatic Wordle Bot scrape (auto / full / incremental modes)
- Local game storage (chrome.storage.local)
- Fast bulk import with de-duplication & data richness merge
- Streak, win rate, average guesses, and time‑frame filtered stats
- Accessible React popup (keyboard & screen reader friendly)
- Debug-friendly logging (opt-in)

## Recent Performance Improvements
| Area | Before | After |
|------|--------|-------|
| Bulk import (94 games) | ~120s (multiple full rewrites) | < 1s (single optimized write, images stripped) |
| Re-scrape iteration cost | Re-processed all cards | Cached already parsed cards |
| Inter-iteration delay | 900ms | 300ms |
| Navigation delays | 450–1200ms | 200–500ms |

## Repository Structure (Simplified)
```
src/
  extension/
    background/        # Service worker & storage logic
    content/           # Wordle Bot scraper content script
    popup/             # React popup UI
    utils/logger.ts    # Centralized debug logger
  ...
public/                # Icons & static assets
scripts/               # Dev/benchmark scripts
```

## Debug Logging
Enable verbose timestamped logs:

Build-time (recommended):
```
VITE_DEBUG_LOGS=true npm run build
```
Runtime (from DevTools console):
```js
WORDLE_ENABLE_DEBUG_LOGS();  // turn on
WORDLE_DISABLE_DEBUG_LOGS(); // turn off
```

The logger is centralized in `src/extension/utils/logger.ts`. All prior ad‑hoc console overrides were removed.

## Quick Build & Reload (Development)
Use the provided script to bundle quickly for iterative testing:
```
node quick-build-extension.js
```
Then reload the unpacked extension in `chrome://extensions`.

## Scripts of Interest

- `scripts/quick-build-extension.js` – fast rebuild for MV3 contexts  
- `scripts/performance-benchmark.ts` – optional performance probes

## Environment Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `VITE_DEBUG_LOGS` | Enables debug logging | false |

## Contributing
See `src/CONTRIBUTING.md` for project structure, coding standards, and contribution workflow.

## Roadmap / Ideas
- IndexedDB migration for larger histories
- Cloud sync (opt-in)
- Extended analytics (letter frequency, opening efficacy)

## Troubleshooting
| Symptom | Resolution |
|---------|------------|
| Popup stuck at "Importing" | Ensure Wordle Bot page fully loads; open DevTools for logs |
| No games imported | Verify you’re logged into NYTimes and Wordle Bot history is accessible |
| Long delays on last page | Network latency from NYT; scraper now minimizes internal waits |

## License
MIT (add LICENSE file if not present).
