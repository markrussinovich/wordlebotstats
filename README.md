# Wordle Stat Explorer

Wordle Stat Explorer is a Chrome/Edge Manifest V3 extension that scrapes your NYTimes Wordle Bot history, stores the results locally, and surfaces rich insights through a lightweight popup and a full analytics dashboard.

## ✨ Capabilities

- Automatic Wordle Bot data import (auto, incremental, and full refresh modes)
- Local-only storage with fast de-duplication and board-image cleanup
- Popup quick stats: win rate, average guesses (2 decimals), streaks, and game counts by time frame
- React-powered dashboard with timelines, trend analysis, WordleBot skill/luck scores, and data management tools
- Manual import/export utilities plus diagnostic logging for troubleshooting

## 📸 Screenshot

> _Replace this placeholder with an actual screenshot of the dashboard or popup._

![Wordle Stat Explorer dashboard placeholder](docs/images/screenshot-placeholder.png "Replace with an actual screenshot")

## 🏗 Architecture Overview

- **Background Service Worker (`src/extension/background`)** – orchestrates storage, message routing, scraper state, and dashboard tab management.
- **Content Scripts (`src/extension/content`)** – interact with the NYTimes Wordle and Wordle Bot pages to capture results safely.
- **Popup (`src/extension/popup`)** – a vanilla HTML/JS UI that displays quick stats and links into the dashboard.
- **Dashboard (`src/dashboard`)** – React + Vite single-page app that visualizes historical performance, fed by Zustand stores.
- **Shared Domain Layer (`src/models`, `src/types`, `src/utils`)** – normalized game data models, TypeScript contracts, and helper utilities (e.g., streak calculations).
- **State Stores (`src/stores`)** – Zustand slices for games, benchmarks, and preferences shared across popup and dashboard contexts.

### Data Flow

1. Content scripts scrape or import Wordle game results and send them to the background service worker.
2. The background persists data to `chrome.storage` and exposes it through message handlers.
3. The popup requests aggregated stats for quick display, while the dashboard pulls full datasets and benchmarks via shared stores.
4. User actions (refresh, import/export, settings) propagate back through the worker, keeping everything in sync.

## 📂 Repository Structure

```text
.
├── config/                 # Shared tooling config (Jest, Vite, TS)
├── docs/                   # Project documentation
├── public/                 # Icons and public assets bundled into dist
├── scripts/                # Developer utilities (build, benchmarks, etc.)
├── src/
│   ├── components/
│   │   ├── charts/         # Reusable visualization components
│   │   └── ui/             # Shared UI primitives (Card, Button, etc.)
│   ├── dashboard/          # React dashboard app (pages, hooks, styling)
│   ├── extension/
│   │   ├── background/     # MV3 service worker and storage helpers
│   │   ├── content/        # Wordle / Wordle Bot content scripts
│   │   ├── popup/          # Popup HTML + JS entry point
│   │   └── utils/          # Extension-specific utilities (logger)
│   ├── models/             # Domain models for stats & benchmarks
│   ├── stores/             # Zustand stores (games, benchmarks, prefs)
│   ├── types/              # Shared TypeScript contracts
│   └── utils/              # Cross-cutting helpers (streak calc, etc.)
├── tests/                  # Unit and integration tests (Jest + Playwright)
├── package.json
└── README.md
```

## 🧪 Development Workflow

### Install Dependencies

```cmd
npm install
```

### Build the Extension

Bundles the popup, dashboard, background worker, and content scripts into `dist/`.

```cmd
npm run build:quick
```

### Run Tests

Runs the Jest unit test suite (React component tests and utility coverage).

```cmd
npm test
```
### Load the Extension in Chrome/Edge

1. Build using the command above (ensures fresh assets in `dist/`).
2. Navigate to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project’s `dist/` folder.
5. Click the extension toolbar icon to open the popup or visit the dashboard tab directly if already open.

## ⚙️ Configuration & Environment

- **Logging:** Enable verbose logging by toggling helpers exposed in the background console (`WORDLE_ENABLE_DEBUG_LOGS()` / `WORDLE_DISABLE_DEBUG_LOGS()`).
- **Storage:** All data stays local via `chrome.storage.local`; benchmarks and settings live in Zustand stores for instant access.
- **Benchmarks:** Default national and WordleBot benchmarks ship with the extension and can be refreshed from the dashboard.

## 🔒 Privacy

**Wordle Stat Explorer respects your privacy and operates with complete transparency.**

Wordle Stat Explorer collects only the data necessary to provide statistics about your Wordle games:

- **Wordle game results**: Puzzle numbers, dates, guess counts, board states, and win/loss status
- **WordleBot metrics**: Skill and luck scores when available from the NYTimes WordleBot page
- **User preferences**: Display settings, dashboard filters, and time range selections

All data is stored **locally on your device** using Chrome's `chrome.storage.local` API:

- ✅ No data is ever transmitted to external servers
- ✅ No analytics, tracking pixels, or telemetry
- ✅ No user accounts, authentication, or cloud sync
- ✅ All data remains under your control

The extension requests only the minimal permissions needed:

- **Storage**: To save your game history and preferences locally
- **Host permissions for `*.nytimes.com`**: To read your Wordle game data from the NYTimes website when you visit the Wordle Bot page
- **Scripting**: To inject content scripts that extract game data from the NYTimes pages

### Updates to This Policy

Any changes to this privacy policy will be reflected in this document and noted in the extension's changelog.

### Contact

Questions or concerns about privacy? Open an issue on GitHub: <https://github.com/markrussinovich/wordlebotstats/issues>

---

## 📘 Additional Resources

- `docs/` – supplementary guides (manual testing, performance notes, etc.)
- `src/CONTRIBUTING.md` – coding standards and contribution workflow
- `REPOSITORY-STRUCTURE.md` – deep dive into directory responsibilities

---

Enjoy tracking your Wordle journey! Contributions, bug reports, and feature suggestions are always welcome.
