import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

test.describe('Extension Diagnostic Tests', () => {
  let context: BrowserContext;
  let serviceWorkerPage: Page | null = null;

  test.beforeAll(async () => {
    const pathToExtension = path.join(process.cwd(), 'dist');
    console.log('Loading extension from:', pathToExtension);
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Try to get service worker
    await context.waitForTimeout(3000);
    const workers = context.serviceWorkers();
    console.log('Service workers found:', workers.length);
    
    if (workers.length > 0) {
      console.log('Service worker URL:', workers[0].url());
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('extension files exist and are valid', async () => {
    const fs = require('fs');
    const distPath = path.join(process.cwd(), 'dist');
    
    // Check manifest
    const manifestPath = path.join(distPath, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('Manifest version:', manifest.manifest_version);
    console.log('Extension name:', manifest.name);
    console.log('Background:', manifest.background);
    
    // Check background.js
    const backgroundPath = path.join(distPath, 'background.js');
    expect(fs.existsSync(backgroundPath)).toBe(true);
    
    const backgroundContent = fs.readFileSync(backgroundPath, 'utf8');
    console.log('Background.js size:', backgroundContent.length, 'bytes');
    
    // Check for critical errors in the code
    expect(backgroundContent).not.toContain('indexedDB');
    expect(backgroundContent).toContain('chrome.storage');
    expect(backgroundContent).toContain('chrome.runtime');
  });

  test('can open extension popup', async () => {
    const page = await context.newPage();
    
    // Get extension ID from service workers
    const workers = context.serviceWorkers();
    let extensionId = '';
    
    if (workers.length > 0) {
      const workerUrl = workers[0].url();
      extensionId = workerUrl.split('/')[2];
      console.log('Extension ID:', extensionId);
    } else {
      // Try to find extension ID another way
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(2000);
      console.log('Could not find service worker, trying to get ID from extensions page');
    }
    
    if (extensionId) {
      // Navigate to popup
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      console.log('Navigating to:', popupUrl);
      
      try {
        await page.goto(popupUrl, { waitUntil: 'networkidle', timeout: 10000 });
        
        // Check if popup loaded
        const content = await page.content();
        console.log('Popup HTML length:', content.length);
        
        // Look for popup root
        const popupRoot = await page.$('#popup-root');
        console.log('Popup root found:', !!popupRoot);
        
        // Check for any error messages
        const errorElements = await page.$$('.error');
        console.log('Error elements found:', errorElements.length);
        
        // Take screenshot
        await page.screenshot({ path: 'test-results/popup-screenshot.png' });
        
      } catch (error) {
        console.error('Error loading popup:', error);
      }
    }
    
    await page.close();
  });

  test('service worker logs check', async () => {
    const workers = context.serviceWorkers();
    console.log('Total service workers:', workers.length);
    
    if (workers.length > 0) {
      const worker = workers[0];
      console.log('Service worker URL:', worker.url());
      
      // Listen for console messages
      const messages: string[] = [];
      worker.on('console', (msg) => {
        const text = msg.text();
        messages.push(`[${msg.type()}] ${text}`);
        console.log(`SW Console [${msg.type()}]:`, text);
      });
      
      // Wait a bit to collect messages
      await context.waitForTimeout(5000);
      
      console.log('Total console messages:', messages.length);
      
      // Check for critical errors
      const errors = messages.filter(m => m.includes('[error]'));
      console.log('Errors found:', errors.length);
      
      if (errors.length > 0) {
        console.log('Errors:', errors);
      }
    } else {
      console.log('⚠️  No service worker found - extension may have failed to load');
      
      // Try to get more info
      const pages = context.pages();
      console.log('Open pages:', pages.length);
      
      for (const page of pages) {
        console.log('Page URL:', page.url());
      }
    }
  });

  test('check chrome.storage availability', async () => {
    // Open a test page within the extension context
    const workers = context.serviceWorkers();
    
    if (workers.length > 0) {
      const worker = workers[0];
      const extensionId = worker.url().split('/')[2];
      
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Test chrome.storage from popup context
      const storageTest = await page.evaluate(async () => {
        try {
          // Test if chrome.storage is available
          if (typeof chrome === 'undefined') {
            return { error: 'chrome object not defined' };
          }
          
          if (typeof chrome.storage === 'undefined') {
            return { error: 'chrome.storage not defined' };
          }
          
          // Try to use storage
          await chrome.storage.local.set({ test: 'value' });
          const result = await chrome.storage.local.get('test');
          
          return { success: true, value: result.test };
        } catch (error: any) {
          return { error: error.message };
        }
      });
      
      console.log('Storage test result:', storageTest);
      
      await page.close();
    }
  });
});
