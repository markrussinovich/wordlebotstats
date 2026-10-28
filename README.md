# Wordle Stat Explorer

Wordle Stat Explorer is a Chrome/Edge Manifest V3 extension that scrapes your NYTimes Wordle Bot history, stores the results locally, and surfaces rich insights through a lightweight popup and a full analytics dashboard. See the loading instructions in the developer section if you want to just install the extension. The current version is in the dist folder so no need to rebuild.

## ✨ Capabilities

- Automatic Wordle data import (auto, incremental, and full refresh modes)
- Local-only storage with fast de-duplication and board-image cleanup
- Popup quick stats: win rate, average guesses, streaks, and game counts by time frame
- React-powered dashboard with timelines, trend analysis, WordleBot skill/luck scores
- Solve analytics: per-game tiles and daily/20-game trends comparing your turns, a local solver, and per-puzzle NYT reader averages. Expand a tile to reveal the solver's guesses and feedback.

### Analysis branch

History imports reconcile all history WordleBot makes available, including older gaps and partial records, rather than stopping at the newest stored date. Explicit `stopAtDate` limits are still supported. Each page is saved before loading the next. Pagination failures and page limits report incomplete imports and preserve the games already read; retrying safely merges data, including after a same-day failure. NYT may limit how far back its history is available; the extension cannot recover games NYT no longer provides.

The local solver runs off the UI thread and caches versioned results in local extension storage. It uses a fixed **SLATE** opening, correct duplicate-letter feedback, equal candidate probabilities, and minimum expected remaining candidates among candidate words plus 128 informative probe words. With at most eight candidates it searches for minimum expected turns over the full bundled guess dictionary (not optimized for the six-turn deadline). This is a WordleBot-style heuristic, **not NYT WordleBot, not globally optimal**, and not a hindsight solution that starts with the known answer. It always uses normal mode; your hard-mode games are marked.

The popup computes and caches solver results independently of the dashboard. Its game card shows the per-puzzle NYT reader average (or N/A when unavailable) and local solver turns. Click Solver to switch to its feedback-colored board, labelled local solver/normal mode; the left control becomes User with your turn count and switches back to your board. Luck/Skill always describe your game. Partial imports show a compact dismissible warning; authentication failures and wholly failed imports remain errors.

The bundled 15,921-word dictionary is the five-letter subset of public-domain [dwyl/english-words](https://github.com/dwyl/english-words), pinned to revision `20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c` (license in `src/solver/data/LICENSE.txt`). It includes obscure words and words NYT may reject, and is not NYT's answer/guess list. Answers outside it show N/A. Regenerate it with `node scripts\update-solver-dictionary.mjs`; dictionary or policy changes require a solver cache version bump.

NYT reader means load automatically from WordleBot's public per-puzzle `summary.json`, not the ordinary daily puzzle API or recent-score aggregate. The calculation matches WordleBot's reader distribution and failure penalty. Normal mode is the fallback when history does not identify a mode; viewing a daily analysis captures its mode only when the puzzle number and played guesses match your stored game. The reader mode is shown in the popup tooltip and dashboard details. Requests are anonymous, bounded, and cached; unavailable summaries remain N/A without blocking imports. You can enter a per-puzzle figure in a tile's details (marked user-entered, saved locally, and never overwritten by automatic retrieval). Head-to-head summaries use only matching played games and show coverage. Your and the local solver's failures count as seven turns for comparisons; rolling plots use available observations and leave missing points blank.

## 📸 Screenshot
![Wordle Stat Explorer dashboard](https://github.com/markrussinovich/wordlebotstats/blob/001-wordle-stat-explorer/listing/assets/popupanddashboard.png)

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

All data is stored locally on your device with no external data transmission. For complete details about our privacy practices, data collection, and your rights, please see our [Privacy Policy](PRIVACY.md).

---

Enjoy tracking your Wordle journey! Contributions, bug reports, and feature suggestions are always welcome.
