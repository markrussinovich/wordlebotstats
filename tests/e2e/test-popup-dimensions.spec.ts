import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Popup Dimensions Measurement', () => {
  test('measure popup states and calculate required padding', async ({ page }) => {
    // Build extension first to ensure latest changes
    const distPath = path.resolve(__dirname, '../../dist');
    console.log('Using extension from:', distPath);

    // Navigate to a page
    await page.goto('about:blank');

    // Load popup HTML directly to measure
    const popupHtmlPath = path.resolve(__dirname, '../../dist/popup.html');
    
    if (!fs.existsSync(popupHtmlPath)) {
      console.error('Popup not built. Run npm run build:quick first.');
      return;
    }

    // Create a test page that loads the popup
    await page.goto(`file:///${popupHtmlPath.replace(/\\/g, '/')}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Measure popup-main in different states
    console.log('\n=== MEASURING POPUP STATES ===\n');

    // 1. Measure with stats loaded (if available)
    const statsGridExists = await page.locator('.stats-grid').count() > 0;
    const lastGameExists = await page.locator('.last-game-section').count() > 0;
    
    if (statsGridExists) {
      const mainBox = await page.locator('.popup-main').boundingBox();
      const statsBox = await page.locator('.stats-grid').boundingBox();
      const lastGameBox = lastGameExists ? await page.locator('.last-game-section').boundingBox() : null;
      
      console.log('Stats State:');
      console.log('  .popup-main height:', mainBox?.height);
      console.log('  .stats-grid height:', statsBox?.height);
      if (lastGameBox) {
        console.log('  .last-game-section height:', lastGameBox.height);
      }
      
      // Calculate content height
      const contentHeight = (lastGameBox?.height || 0) + (statsBox?.height || 0) + 16; // 16px gap
      console.log('  Total content height:', contentHeight);
      
      await page.screenshot({ path: 'artifacts/popup-stats.png' });
    }

    // 2. Check loading state
    const loadingExists = await page.locator('.loading-state').count() > 0;
    if (loadingExists) {
      const loadingBox = await page.locator('.loading-state').boundingBox();
      const mainBox = await page.locator('.popup-main').boundingBox();
      
      console.log('\nLoading State:');
      console.log('  .popup-main height:', mainBox?.height);
      console.log('  .loading-state height:', loadingBox?.height);
      
      await page.screenshot({ path: 'artifacts/popup-loading.png' });
    }

    // 3. Inject scraper status to measure scraper state
    await page.evaluate(() => {
      // Simulate scraper active state
      const container = document.getElementById('popup-root');
      if (container) {
        container.innerHTML = `
          <div class="popup-container">
            <header class="popup-header">
              <div class="popup-header-top">
                <h1>Wordle Stats</h1>
                <button class="refresh-btn" disabled>↻ Refresh</button>
              </div>
              <div class="time-frame-picker">
                <button class="time-frame-btn active">7D</button>
                <button class="time-frame-btn">30D</button>
                <button class="time-frame-btn">90D</button>
                <button class="time-frame-btn">ALL</button>
              </div>
            </header>
            <main class="popup-main">
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-message">Found 150 games...</div>
              </div>
            </main>
            <footer class="popup-footer">
              <button class="dashboard-link" disabled>Open Dashboard</button>
            </footer>
          </div>
        `;
      }
    });

    await page.waitForTimeout(500);
    const scraperMainBox = await page.locator('.popup-main').boundingBox();
    const scraperLoadingBox = await page.locator('.loading-state').boundingBox();
    
    console.log('\nScraper State (simulated):');
    console.log('  .popup-main height:', scraperMainBox?.height);
    console.log('  .loading-state height:', scraperLoadingBox?.height);
    
    await page.screenshot({ path: 'artifacts/popup-scraper.png' });

    console.log('\n=== CALCULATIONS ===');
    console.log('If stats content is X height, loading-state needs:');
    console.log('  padding = (X - spinner(42) - gap(16) - message(~20)) / 2 for top and bottom');
    console.log('\nCurrent loading-state padding: 95px top, 95px bottom');
  });
});
