# Repository Structure

This document describes the reorganized repository structure following standard project conventions.

## Directory Structure

```
wordlebotstats/
├── src/                    # Extension source code
│   ├── components/         # Reusable React components
│   ├── dashboard/          # Dashboard application
│   ├── extension/          # Browser extension core
│   │   ├── background/     # Service worker / background script
│   │   ├── content/        # Content scripts
│   │   └── popup/          # Extension popup UI
│   ├── models/             # Data models
│   ├── services/           # Business logic services
│   ├── stores/             # State management (Zustand)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
│
├── tests/                  # All automated tests
│   ├── components/         # Component tests
│   ├── e2e/                # End-to-end tests (Playwright)
│   ├── extension/          # Extension-specific tests
│   ├── fixtures/           # Test fixtures and mock data
│   ├── messaging/          # Messaging tests
│   ├── models/             # Model tests
│   ├── services/           # Service tests
│   ├── utils/              # Utility tests
│   └── setup.ts            # Test setup configuration
│
├── scripts/                # Build and utility scripts
│   ├── quick-build-extension.js    # Fast extension build
│   ├── generate-wordle-icons.ts    # Icon generation
│   ├── performance-benchmark.ts    # Performance testing
│   └── [other scripts]             # Various build utilities
│
├── tools/                  # Development tools & debug utilities
│   ├── test-*.js           # Manual test scripts
│   ├── debug-*.js          # Debugging utilities
│   ├── inspect-*.js        # Inspection tools
│   └── verify-changes.ps1  # Verification scripts
│
├── config/                 # Configuration files
│   ├── vite.config.ts              # Main Vite configuration
│   ├── vite.config.popup.ts        # Popup build config
│   ├── vite.config.dashboard.ts    # Dashboard build config
│   ├── tsconfig.json               # TypeScript configuration
│   ├── tsconfig.node.json          # Node TypeScript config
│   ├── jest.config.js              # Jest test configuration
│   ├── playwright.config.ts        # Playwright E2E config
│   ├── .eslintrc.js                # ESLint rules
│   └── .prettierrc                 # Prettier formatting
│
├── docs/                   # Documentation
│   ├── BUILD-COMPLETE.md           # Build notes
│   ├── EXTENSION-SOURCE-FILES.md   # Source organization
│   ├── HOW-TO-APPLY-FIXES.md       # Fix application guide
│   ├── MANUAL_TEST_INSTRUCTIONS.md # Testing procedures
│   ├── PERFORMANCE.md              # Performance docs
│   ├── TEST_RESULTS_SUMMARY.md     # Test results
│   └── [other docs]                # Various documentation
│
├── artifacts/              # Build artifacts (gitignored)
│   ├── playwright-report/  # Test reports
│   ├── test-results/       # Test outputs
│   ├── temp_*.txt          # Temporary files
│   └── *.json              # Performance reports
│
├── dist/                   # Build output (gitignored)
│   ├── background.js       # Built background script
│   ├── content.js          # Built content scripts
│   ├── wordleBotContent.js # Built WordleBot content script
│   ├── popup.html          # Popup HTML
│   ├── popup.js            # Popup script
│   ├── dashboard.html      # Dashboard HTML
│   ├── dashboard.js        # Dashboard bundle
│   ├── dashboard.css       # Dashboard styles
│   ├── manifest.json       # Extension manifest
│   └── public/             # Static assets (icons, etc.)
│
├── public/                 # Static assets (source)
│   └── icons/              # Extension icons
│
├── .github/                # GitHub configurations
│   └── copilot-instructions.md
│
├── .specify/               # Specify configuration
├── specs/                  # Feature specifications
│
└── [root files]
    ├── package.json        # NPM dependencies and scripts
    ├── README.md           # Project README
    ├── .gitignore          # Git ignore rules
    ├── reorganize-repo.js  # Repository reorganization script
    └── [other config]      # Various root configuration files
```

## Key Conventions

### Source Code (`src/`)
- All production source code
- Organized by feature and layer (components, services, models)
- Extension-specific code in `extension/` subdirectory

### Tests (`tests/`)
- Mirrors `src/` structure
- Unit tests alongside integration tests
- E2E tests in separate `e2e/` directory
- Shared fixtures and setup

### Configuration (`config/`)
- All build and tooling configuration
- Centralized for easy maintenance
- Separated from source code

### Documentation (`docs/`)
- Implementation guides
- Architecture decisions
- Test reports and procedures
- No docs mixed with source

### Tools vs Scripts
- **scripts/**: Build automation, production-related
- **tools/**: Development utilities, debug helpers

### Artifacts (`artifacts/`)
- Gitignored directory for build outputs
- Test reports and coverage
- Temporary development files
- Performance reports

## Build Commands

All build commands automatically reference the correct config files:

```bash
# Build extension (quick)
npm run build:quick

# Full production build
npm run build:extension

# Build specific parts
npm run build:popup
npm run build:dashboard

# Run tests
npm test                    # Unit tests
npm run test:e2e            # E2E tests

# Code quality
npm run lint                # Lint code
npm run format              # Format code
npm run typecheck           # Type checking
```

## Migration Notes

### Updated References
- All config files now in `config/` directory
- Build commands reference `config/` paths
- Path aliases still work from any location (`@/...`)
- Test configurations point to root directories

### Benefits
1. **Cleaner root**: No clutter from test files and docs
2. **Standard structure**: Follows industry conventions
3. **Better separation**: Clear boundaries between code types
4. **Easier navigation**: Logical organization
5. **Scalability**: Easy to add new features/tools

## Adding New Files

### New source file
→ Place in appropriate `src/` subdirectory

### New test
→ Place in `tests/` mirroring `src/` structure

### New build script
→ Place in `scripts/` directory

### New debug tool
→ Place in `tools/` directory

### New documentation
→ Place in `docs/` directory

### New configuration
→ Place in `config/` directory
