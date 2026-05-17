import { test } from '@playwright/test';
import { chromium } from '@playwright/test';
import path from 'path';

test.describe('Dashboard Tests', () => {
  test('should load dashboard page', async () => {
    const extensionPath = path.join(__dirname, 'dist');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    const page = await context.newPage();
    
    // Navigate to the dashboard
    await page.goto(`file:///${path.join(__dirname, 'dist', 'dashboard.html').replace(/\\/g, '/')}`);
    
    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-container, .dashboard-loading, .dashboard-empty', { timeout: 10000 });
    
    // Take a screenshot
    await page.screenshot({ path: 'dashboard-test-screenshot.png', fullPage: true });
    
    // Check for basic elements
    const header = await page.locator('h1').first();
    console.log('Header found:', await header.isVisible());
    
    // Get page content for debugging
    const bodyText = await page.locator('body').textContent();
    console.log('Page text content:', bodyText?.substring(0, 500));
    
    // Check for any error messages
    const errorElements = await page.locator('.error, .dashboard-error').count();
    console.log('Error elements found:', errorElements);
    
    await context.close();
  });
});
