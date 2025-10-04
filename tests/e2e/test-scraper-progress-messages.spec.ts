import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Scraper Progress Messages', () => {
  const syntheticPagePath = `file://${path.resolve(__dirname, '../fixtures/synthetic-wordlebot.html').replace(/\\/g, '/')}`;
  
  test('should show test mode indicator on synthetic page', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Check for test mode indicator
    const indicator = await page.locator(':text("TEST MODE")').isVisible();
    expect(indicator).toBe(true);
    
    console.log('✓ Test mode indicator visible');
    
    // Verify window object
    const isTestPage = await page.evaluate(() => {
      return (window as any).__SYNTHETIC_WORDLEBOT__?.isTestPage === true;
    });
    
    expect(isTestPage).toBe(true);
    console.log('✓ Synthetic page properly identified');
  });
  
  test('should detect test environment automatically', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    const envDetected = await page.evaluate(() => {
      const isTest = navigator.webdriver || window.location.protocol === 'file:';
      return isTest;
    });
    
    expect(envDetected).toBe(true);
    console.log('✓ Test environment auto-detected');
  });
  
  test('should scrape games with progress updates', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Inject the v5 scraper
    const v5ScraperPath = path.resolve(__dirname, '../../scripts/wordle-bot-extractor-v5.js');
    await page.addScriptTag({ path: v5ScraperPath });
    
    await page.waitForTimeout(1000);
    
    // Track progress messages
    const progressMessages: string[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Iteration') || text.includes('games') || text.includes('Found')) {
        progressMessages.push(text);
      }
    });
    
    // Run scrape with progress tracking
    const result = await page.evaluate(async () => {
      const progress: Array<{ iteration: number; gamesFound: number; totalUnique: number }> = [];
      
      // Mock scrapeAllGames with progress tracking
      const scraper = (window as any).__WORDLE_EXTRACTOR_V5__;
      const games = await scraper.scrapeAllGames(5);
      
      return {
        totalGames: games.length,
        firstGame: games[0],
        lastGame: games[games.length - 1]
      };
    });
    
    console.log('✓ Scrape completed:', result);
    console.log('✓ Progress messages captured:', progressMessages.length);
    
    expect(result.totalGames).toBeGreaterThanOrEqual(13);
    expect(result.firstGame.solution).toBeTruthy();
  });
  
  test('should simulate realistic scraping speed', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    const v5ScraperPath = path.resolve(__dirname, '../../scripts/wordle-bot-extractor-v5.js');
    await page.addScriptTag({ path: v5ScraperPath });
    
    await page.waitForTimeout(500);
    
    const startTime = Date.now();
    
    // Scrape with multiple iterations to test pagination
    await page.evaluate(async () => {
      const scraper = (window as any).__WORDLE_EXTRACTOR_V5__;
      return await scraper.scrapeAllGames(3); // Max 3 iterations
    });
    
    const duration = Date.now() - startTime;
    
    console.log('✓ Scrape duration:', duration, 'ms');
    console.log('✓ Realistic timing:', duration >= 500 ? 'Yes' : 'Too fast');
    
    // Should take at least 500ms (pagination delays)
    expect(duration).toBeGreaterThanOrEqual(500);
  });
  
  test('should report progress for each iteration', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    const v5ScraperPath = path.resolve(__dirname, '../../scripts/wordle-bot-extractor-v5.js');
    await page.addScriptTag({ path: v5ScraperPath });
    
    await page.waitForTimeout(500);
    
    const progressLog: string[] = [];
    
    page.on('console', msg => {
      progressLog.push(msg.text());
    });
    
    await page.evaluate(async () => {
      const scraper = (window as any).__WORDLE_EXTRACTOR_V5__;
      return await scraper.scrapeAllGames(2);
    });
    
    // Check for iteration messages
    const iterationMessages = progressLog.filter(msg => msg.includes('Iteration'));
    console.log('✓ Iteration progress messages:', iterationMessages.length);
    
    expect(iterationMessages.length).toBeGreaterThanOrEqual(1);
  });
  
  test('should handle pagination button visibility', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    // Check initial button state
    const showMoreBtn = page.locator('.show-more-button.svelte-151vgtd');
    const initiallyVisible = await showMoreBtn.isVisible();
    
    console.log('✓ Show more button initially visible:', initiallyVisible);
    
    if (initiallyVisible) {
      // Click and verify it hides
      await showMoreBtn.click();
      await page.waitForTimeout(500);
      
      const afterClick = await showMoreBtn.isVisible();
      expect(afterClick).toBe(false);
      
      console.log('✓ Button hidden after click');
    }
  });
  
  test('should extract games with correct progress count', async ({ page }) => {
    await page.goto(syntheticPagePath);
    
    const v5ScraperPath = path.resolve(__dirname, '../../scripts/wordle-bot-extractor-v5.js');
    await page.addScriptTag({ path: v5ScraperPath });
    
    await page.waitForTimeout(500);
    
    // Capture the summary
    const summary = await page.evaluate(() => {
      return (window as any).__WORDLE_EXTRACTOR_V5__.summary;
    });
    
    console.log('✓ Scraper summary:', {
      gameCardsFound: summary.gameCardsFound,
      hasShowMoreButton: summary.hasShowMoreButton,
      samples: summary.samples.length
    });
    
    expect(summary.gameCardsFound).toBeGreaterThanOrEqual(13);
    expect(summary.samples.length).toBeGreaterThanOrEqual(5);
  });
});
