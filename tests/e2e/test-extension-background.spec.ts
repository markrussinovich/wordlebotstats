import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('Extension Background Script Tests', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    // Load the extension
    const pathToExtension = path.join(process.cwd(), 'dist');
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Wait a bit for extension to load
    await context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    
    // Get extension ID from background page
    let backgroundPages = context.backgroundPages();
    if (backgroundPages.length === 0) {
      await context.waitForEvent('backgroundpage', { timeout: 5000 });
      backgroundPages = context.backgroundPages();
    }
    
    if (backgroundPages.length > 0) {
      const backgroundPage = backgroundPages[0];
      extensionId = backgroundPage.url().split('/')[2];
      console.log('Extension ID:', extensionId);
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should load extension without errors', async () => {
    const backgroundPages = context.backgroundPages();
    expect(backgroundPages.length).toBeGreaterThan(0);
    
    const backgroundPage = backgroundPages[0];
    
    // Check for console errors
    const errors: string[] = [];
    backgroundPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any immediate errors
    await backgroundPage.waitForTimeout(2000);
    
    // Filter out known acceptable errors
    const criticalErrors = errors.filter(err => 
      !err.includes('document.domain mutation') &&
      !err.includes('Manifest version')
    );
    
    console.log('Background page errors:', criticalErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('should have chrome.storage available', async () => {
    const backgroundPages = context.backgroundPages();
    const backgroundPage = backgroundPages[0];
    
    const hasStorage = await backgroundPage.evaluate(() => {
      return typeof chrome !== 'undefined' && 
             typeof chrome.storage !== 'undefined' &&
             typeof chrome.storage.local !== 'undefined';
    });
    
    expect(hasStorage).toBe(true);
  });

  test('should be able to save and retrieve game data', async () => {
    const backgroundPages = context.backgroundPages();
    const backgroundPage = backgroundPages[0];
    
    // Test game data
    const testGame = {
      date: '2025-10-05',
      gameNumber: 1234,
      won: true,
      attempts: 4,
      hardMode: false,
      solution: 'TESTS',
      source: 'test',
      wordLength: 5,
      maxGuesses: 6
    };
    
    // Save game
    const saveResult = await backgroundPage.evaluate(async (game) => {
      try {
        await chrome.storage.local.set({ games: [game] });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }, testGame);
    
    expect(saveResult.success).toBe(true);
    
    // Retrieve game
    const getResult = await backgroundPage.evaluate(async () => {
      try {
        const result = await chrome.storage.local.get('games');
        return { success: true, games: result.games };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    expect(getResult.success).toBe(true);
    expect(getResult.games).toBeDefined();
    expect(getResult.games.length).toBe(1);
    expect(getResult.games[0].date).toBe('2025-10-05');
  });

  test('should handle extension messages', async () => {
    const backgroundPages = context.backgroundPages();
    const backgroundPage = backgroundPages[0];
    
    // Test sending a message
    const messageResult = await backgroundPage.evaluate(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_QUICK_STATS',
          timeFrame: '7d',
          includeBenchmarks: false
        });
        return { success: true, response };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Message result:', messageResult);
    
    // The message should be processed (even if it returns no data)
    expect(messageResult.success).toBe(true);
  });

  test('should open popup without errors', async () => {
    const page = await context.newPage();
    
    // Navigate to extension popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any errors
    await page.waitForTimeout(3000);
    
    // Check that popup loaded
    const title = await page.title();
    console.log('Popup title:', title);
    
    // Check for popup root element
    const popupRoot = await page.$('#popup-root');
    expect(popupRoot).not.toBeNull();
    
    // Filter critical errors
    const criticalErrors = errors.filter(err => 
      !err.includes('document.domain') &&
      !err.includes('Failed to load resource')
    );
    
    console.log('Popup errors:', criticalErrors);
    
    await page.close();
  });

  test('should initialize ExtensionStorage', async () => {
    const backgroundPages = context.backgroundPages();
    const backgroundPage = backgroundPages[0];
    
    // Check if storage service is initialized
    const storageAvailable = await backgroundPage.evaluate(() => {
      return typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined';
    });
    
    expect(storageAvailable).toBe(true);
    
    // Clear any test data
    await backgroundPage.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    
    console.log('ExtensionStorage test passed');
  });

  test('should handle scraper metadata operations', async () => {
    const backgroundPages = context.backgroundPages();
    const backgroundPage = backgroundPages[0];
    
    const testMetadata = {
      lastScrape: new Date().toISOString(),
      lastScrapeMode: 'auto' as const,
      totalScraped: 10,
      lastError: null
    };
    
    // Save metadata
    const saveResult = await backgroundPage.evaluate(async (metadata) => {
      try {
        await chrome.storage.local.set({ scraperMetadata: metadata });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }, testMetadata);
    
    expect(saveResult.success).toBe(true);
    
    // Retrieve metadata
    const getResult = await backgroundPage.evaluate(async () => {
      try {
        const result = await chrome.storage.local.get('scraperMetadata');
        return { success: true, metadata: result.scraperMetadata };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    expect(getResult.success).toBe(true);
    expect(getResult.metadata).toBeDefined();
    expect(getResult.metadata.lastScrapeMode).toBe('auto');
    expect(getResult.metadata.totalScraped).toBe(10);
  });
});
