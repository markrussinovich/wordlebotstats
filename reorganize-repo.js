/**
 * Repository Reorganization Script
 * Moves files to follow standard project structure conventions
 */

import { mkdirSync, renameSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define reorganization plan
const reorganizationPlan = {
  // Documentation files → docs/
  docs: [
    'AUTO-IMPORT-IMPLEMENTATION-SUMMARY.md',
    'BUILD-COMPLETE.md',
    'DEBUG-POPUP-ISSUE.md',
    'EXTENSION-SOURCE-FILES.md',
    'EXTENSION_DATA_ANALYSIS.md',
    'HOW-TO-APPLY-FIXES.md',
    'MANUAL_TEST_INSTRUCTIONS.md',
    'PERFORMANCE.md',
    'POPUP-AUTO-IMPORT-TESTING.md',
    'QUICK-START-TESTING.md',
    'TEST_RESULTS_SUMMARY.md',
    'TIMELINE-CHART-CHANGES.md',
    'URGENT-SOURCE-SYNC-NEEDED.md'
  ],
  
  // Development/debug tools → tools/
  tools: [
    'build-content-scripts.js',
    'build-log.txt',
    'check-wordle-dom.js',
    'debug-text-patterns.js',
    'inspect-cards.js',
    'inspect-wordle-bot.cjs',
    'test-auto-start.cjs',
    'test-chrome-login.js',
    'test-content-script.cjs',
    'test-current-browser.js',
    'test-dashboard.spec.ts',
    'test-direct-injection.js',
    'test-direct-validation.js',
    'test-edge-natural.js',
    'test-edge-profile.js',
    'test-extension-debug.js',
    'test-extension-errors.cjs',
    'test-extension.js',
    'test-final-validation.cjs',
    'test-fixed-patterns.js',
    'test-full-extension-validation.js',
    'test-in-console.js',
    'test-live-debug.js',
    'test-popup-behavior.js',
    'test-popup-streak-display.js',
    'test-scraper-extraction.html',
    'test-simple-extraction.js',
    'test-standalone-scraper.js',
    'test-streak-calculation.js',
    'test-wordle-bot-live.js',
    'test-wordle-bot-manual.js',
    'test-wordle-bot-profile.js',
    'test-wordle-bot-scrape.cjs',
    'test-wordle-bot-simple.js',
    'verify-changes.ps1'
  ],
  
  // Build scripts → scripts/ (already exists)
  scripts: [
    'quick-build-extension.js'
  ],
  
  // Configuration files → config/
  config: [
    'jest.config.js',
    'playwright.config.ts',
    'tsconfig.json',
    'tsconfig.node.json',
    'vite.config.ts',
    'vite.config.dashboard.ts',
    'vite.config.popup.ts',
    '.eslintrc.js',
    '.prettierrc'
  ],
  
  // Temporary/artifact files → artifacts/ (will be gitignored)
  artifacts: [
    'temp_background.txt',
    'temp_calc_stats.txt',
    'temp_content.txt',
    'temp_popup_working.txt',
    'performance-report.json',
    'index.html'
  ]
};

// Directories to move entirely
const directoryMoves = {
  'playwright-report': 'artifacts/playwright-report',
  'test-results': 'artifacts/test-results'
};

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
}

function moveFile(source, destination) {
  const sourcePath = join(__dirname, source);
  const destPath = join(__dirname, destination);
  
  if (!existsSync(sourcePath)) {
    console.log(`⚠ Skipping ${source} (not found)`);
    return false;
  }
  
  try {
    ensureDir(dirname(destPath));
    renameSync(sourcePath, destPath);
    console.log(`✓ Moved: ${source} → ${destination}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to move ${source}:`, error.message);
    return false;
  }
}

function moveDirectory(source, destination) {
  const sourcePath = join(__dirname, source);
  const destPath = join(__dirname, destination);
  
  if (!existsSync(sourcePath)) {
    console.log(`⚠ Skipping ${source} (not found)`);
    return false;
  }
  
  try {
    ensureDir(dirname(destPath));
    renameSync(sourcePath, destPath);
    console.log(`✓ Moved directory: ${source} → ${destination}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to move directory ${source}:`, error.message);
    return false;
  }
}

async function reorganize() {
  console.log('🔄 Starting repository reorganization...\n');
  
  let moved = 0;
  let skipped = 0;
  let failed = 0;
  
  // Create target directories
  console.log('📁 Creating directory structure...');
  ensureDir(join(__dirname, 'docs'));
  ensureDir(join(__dirname, 'tools'));
  ensureDir(join(__dirname, 'config'));
  ensureDir(join(__dirname, 'artifacts'));
  console.log();
  
  // Move files by category
  for (const [category, files] of Object.entries(reorganizationPlan)) {
    console.log(`\n📦 Moving ${category} files...`);
    for (const file of files) {
      const destination = join(category, file);
      const result = moveFile(file, destination);
      if (result) moved++;
      else if (existsSync(join(__dirname, file))) failed++;
      else skipped++;
    }
  }
  
  // Move directories
  console.log('\n📦 Moving directories...');
  for (const [source, destination] of Object.entries(directoryMoves)) {
    const result = moveDirectory(source, destination);
    if (result) moved++;
    else if (existsSync(join(__dirname, source))) failed++;
    else skipped++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Reorganization complete!\n');
  console.log(`   Moved: ${moved} items`);
  console.log(`   Skipped: ${skipped} items (not found)`);
  console.log(`   Failed: ${failed} items`);
  console.log('='.repeat(60));
  
  console.log('\n📋 New structure:');
  console.log(`
wordlebotstats/
├── src/                    # Extension source code
├── tests/                  # All tests
├── scripts/                # Build and utility scripts
├── tools/                  # Development tools and test utilities
├── docs/                   # Documentation
├── config/                 # Configuration files
├── artifacts/              # Build artifacts and reports (gitignore)
├── dist/                   # Build output (gitignore)
├── public/                 # Static assets
├── .github/                # GitHub configurations
└── [root files]            # README, package.json, etc.
  `);
  
  console.log('\n⚠️  NEXT STEPS:');
  console.log('   1. Update import paths in moved config files');
  console.log('   2. Update .gitignore to ignore artifacts/');
  console.log('   3. Update package.json scripts if needed');
  console.log('   4. Test the build process');
}

reorganize().catch(console.error);
