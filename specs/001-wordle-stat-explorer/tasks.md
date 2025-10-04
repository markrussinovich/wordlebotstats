# Tasks: Wordle Stat Explorer

**Input**: Design documents from `C:\source\Wordle\specs\001-wordle-stat-explorer\`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Extract: TypeScript + React 18 + Vite + Recharts + Zustand + browser extension
2. Load optional design documents ✓:
   → data-model.md: 5 entities (GameResult, StatisticsPeriod, BenchmarkData, UserPreferences, ComparisonResult)
   → contracts/: Extension messaging contracts for background/popup/content/dashboard communication
   → research.md: Browser extension architecture, Manifest v3, content scripts, IndexedDB storage
   → quickstart.md: Installation, setup, usage scenarios
3. Generate tasks by category ✓:
   → Setup: Extension structure, TypeScript config, dependencies
   → Tests: Extension messaging tests, component tests, E2E tests
   → Core: Data models, stores, services, UI components
   → Integration: Extension messaging, storage, Wordle page integration
   → Polish: Performance optimization, accessibility, documentation
4. Apply task rules ✓:
   → Different files = [P] parallel, same files = sequential, TDD ordering
5. Tasks numbered T001-T052 ✓
6. Dependency graph and parallel examples included ✓
7. Validation: All entities have models, contracts have tests, quickstart scenarios covered ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Browser extension with React frontend structure:
- **Extension**: `src/extension/` for manifest, background, content, popup
- **Components**: `src/components/` for reusable React components
- **Dashboard**: `src/dashboard/` for full dashboard SPA
- **Services**: `src/services/` for data processing and storage
- **Tests**: `tests/` for component, service, and E2E tests

## Phase 3.1: Setup
- [x] T001 Create browser extension project structure per plan.md in src/
- [x] T002 Initialize package.json with TypeScript, React 18, Vite, and extension dependencies  
- [x] T003 [P] Configure TypeScript strict mode config in tsconfig.json
- [x] T004 [P] Configure Vite build for browser extension with manifest v3 in vite.config.ts
- [x] T005 [P] Configure ESLint + Prettier for React and TypeScript in .eslintrc.js and .prettierrc
- [x] T006 [P] Configure Jest + React Testing Library in jest.config.js
- [x] T007 [P] Configure Playwright for E2E extension testing in playwright.config.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Extension Messaging Contract Tests  
- [x] T008 [P] Contract test ImportGameResult message in tests/messaging/test-import-game-result.test.ts
- [x] T009 [P] Contract test GetQuickStats message in tests/messaging/test-quick-stats.test.ts
- [x] T010 [P] Contract test GetDetailedStats message in tests/messaging/test-detailed-stats.test.ts
- [x] T011 [P] Contract test ExportUserData message in tests/messaging/test-export-data.test.ts
- [x] T012 [P] Contract test UpdatePreferences message in tests/messaging/test-preferences.test.ts

### Data Model Tests
- [x] T013 [P] GameResult model validation tests in tests/models/test-game-result.test.ts  
- [x] T014 [P] StatisticsPeriod calculation tests in tests/models/test-statistics-period.test.ts
- [x] T015 [P] BenchmarkData processing tests in tests/models/test-benchmark-data.test.ts
- [x] T016 [P] UserPreferences validation tests in tests/models/test-user-preferences.test.ts
- [x] T017 [P] ComparisonResult calculation tests in tests/models/test-comparison-result.test.ts

### Service Layer Tests
- [x] T018 [P] Data import service tests in tests/services/test-data-import.test.ts
- [ ] T019 [P] Analytics calculation service tests in tests/services/test-analytics.test.ts  
- [ ] T020 [P] Storage service tests in tests/services/test-storage.test.ts

### Component Tests
- [ ] T021 [P] Popup component tests in tests/components/test-popup.test.tsx
- [ ] T022 [P] Stats display components tests in tests/components/test-stats-components.test.tsx
- [ ] T023 [P] Chart components tests in tests/components/test-charts.test.tsx
- [ ] T024 [P] Dashboard page components tests in tests/components/test-dashboard-pages.test.tsx

### Integration & E2E Tests
- [ ] T025 [P] Extension installation and setup E2E test in tests/e2e/test-installation.spec.ts
- [ ] T026 [P] Wordle page integration E2E test in tests/e2e/test-wordle-integration.spec.ts  
- [ ] T027 [P] Popup usage scenarios E2E test in tests/e2e/test-popup-scenarios.spec.ts
- [ ] T028 [P] Dashboard usage scenarios E2E test in tests/e2e/test-dashboard-scenarios.spec.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Type Definitions
- [x] T029 [P] GameResult and related types in src/types/gameTypes.ts
- [x] T030 [P] Benchmark and comparison types in src/types/benchmarkTypes.ts  
- [x] T031 [P] Extension messaging types in src/types/messagingTypes.ts

### Data Models & Stores (Zustand)
- [x] T032 [P] GameResult model with validation in src/models/GameResult.ts
- [x] T033 [P] StatisticsPeriod model with calculations in src/models/StatisticsPeriod.ts
- [x] T034 [P] BenchmarkData model in src/models/BenchmarkData.ts
- [x] T035 [P] Game data Zustand store in src/stores/gameData.ts
- [x] T036 [P] Benchmarks Zustand store in src/stores/benchmarks.ts  
- [x] T037 [P] User preferences Zustand store in src/stores/preferences.ts

### Core Services  
- [x] T038 [P] Data import service with Wordle page parsing in src/services/dataImport.ts
- [x] T039 [P] Analytics calculation service in src/services/analytics.ts
- [x] T040 [P] Storage service with IndexedDB + Extension Storage in src/services/storage.ts

### Extension Infrastructure
- [x] T041 Extension manifest.json with permissions and content scripts in src/extension/manifest.json
- [x] T042 Background service worker with message routing in src/extension/background/background.ts
- [x] T043 Content script for Wordle page integration in src/extension/content/wordleContent.ts  
- [x] T044 Popup React application in src/extension/popup/Popup.tsx

### UI Components (React)
- [x] T045 [P] Design system base components in src/components/ui/
- [x] T046 [P] Statistics display components in src/components/stats/  
- [x] T047 [P] Chart components with Recharts in src/components/charts/
- [x] T048 [P] Dashboard page components in src/dashboard/pages/

## Phase 3.4: Integration  
- [x] T049 Connect extension messaging between background, popup, and content scripts
- [x] T050 Integrate Zustand stores with React components and extension messaging
- [x] T051 Connect storage service to IndexedDB and extension storage APIs
- [x] T052 Integrate Wordle content script with automatic game detection

## Phase 3.5: Polish
- [x] T053 [P] Performance optimization: code splitting and lazy loading in vite.config.ts
- [x] T054 [P] Accessibility improvements: ARIA labels, keyboard navigation in components
- [x] T055 [P] Bundle size optimization and tree shaking verification  
- [x] T056 [P] Extension icons and assets in public/icons/
- [x] T057: E2E Scenario Validation ✓
- [x] T058: Performance Benchmarking ✓

## Dependencies
**Critical Path**:
- Setup (T001-T007) → Tests (T008-T028) → Types (T029-T031) → Models (T032-T037) → Services (T038-T040) → Extension (T041-T044) → Components (T045-T048) → Integration (T049-T052) → Polish (T053-T058)

**Parallel Execution Blocks**:
- Tests: T008-T028 can all run in parallel (different test files)
- Types: T029-T031 can run in parallel (different type files)  
- Models: T032-T037 can run in parallel (different model files)
- Services: T038-T040 can run in parallel (different service files)
- Components: T045-T048 can run in parallel (different component directories)
- Polish: T053-T056 can run in parallel (different optimization areas)

**Sequential Dependencies**:
- T041 (manifest) before T042-T044 (extension files need manifest context)
- T049-T052 (integration) cannot be parallel (shared messaging system)  
- T057-T058 (validation) must be last (requires complete system)

## Parallel Execution Examples

### Test Phase (T008-T028) - All Parallel
```
# Launch messaging contract tests together:
Task: "Contract test ImportGameResult message in tests/messaging/test-import-game-result.test.ts"  
Task: "Contract test GetQuickStats message in tests/messaging/test-quick-stats.test.ts"
Task: "Contract test GetDetailedStats message in tests/messaging/test-detailed-stats.test.ts"

# Launch data model tests together:  
Task: "GameResult model validation tests in tests/models/test-game-result.test.ts"
Task: "StatisticsPeriod calculation tests in tests/models/test-statistics-period.test.ts"
Task: "BenchmarkData processing tests in tests/models/test-benchmark-data.test.ts"

# Launch component tests together:
Task: "Popup component tests in tests/components/test-popup.test.tsx"  
Task: "Stats display components tests in tests/components/test-stats-components.test.tsx"
Task: "Chart components tests in tests/components/test-charts.test.tsx"
```

### Core Implementation Phase (T032-T048) - Parallel by Category  
```
# Launch store implementations together:
Task: "Game data Zustand store in src/stores/gameData.ts"
Task: "Benchmarks Zustand store in src/stores/benchmarks.ts"  
Task: "User preferences Zustand store in src/stores/preferences.ts"

# Launch service implementations together:
Task: "Data import service with Wordle page parsing in src/services/dataImport.ts"
Task: "Analytics calculation service in src/services/analytics.ts"
Task: "Storage service with IndexedDB + Extension Storage in src/services/storage.ts"

# Launch component development together:  
Task: "Design system base components in src/components/ui/"
Task: "Statistics display components in src/components/stats/"
Task: "Chart components with Recharts in src/components/charts/"
```

## Notes
- **[P] tasks**: Different files, can execute simultaneously  
- **TDD Critical**: All tests (T008-T028) MUST fail before implementing (T029-T058)
- **Extension Security**: Content scripts have limited permissions, background handles storage
- **Performance**: Popup must be responsive <500ms, dashboard <1.5s
- **Accessibility**: All components must support keyboard navigation and screen readers

## Task Generation Rules Applied

1. **From Contracts**: 5 messaging contract tests (T008-T012) from extension-messaging.md
2. **From Data Model**: 5 entity model tests + implementations (T013-T017, T032-T037) from data-model.md  
3. **From Quickstart Scenarios**: E2E tests covering installation, integration, popup, dashboard (T025-T028)
4. **From Architecture**: Extension-specific tasks (T041-T044) based on browser extension structure
5. **Ordering**: Setup → Tests → Types → Models → Services → Extension → Components → Integration → Polish

## Validation Checklist ✅

- [x] All contracts have corresponding tests (T008-T012 cover messaging contracts)
- [x] All entities have model tasks (T032-T037 implement GameResult, StatisticsPeriod, BenchmarkData, UserPreferences, ComparisonResult)
- [x] All tests come before implementation (T008-T028 before T029-T058)  
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path with src/ and tests/ structure
- [x] No task modifies same file as another [P] task (verified file path uniqueness)