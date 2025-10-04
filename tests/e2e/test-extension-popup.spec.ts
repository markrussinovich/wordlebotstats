import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Extension Popup Tests', () => {
  let context: BrowserContext;
  let extensionId: string;
  
  test.beforeAll(async () => {
    const pathToExtension = path.resolve(__dirname, '../../dist');
    
    // Launch browser with extension loaded
    context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    
    // Get extension ID
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    
    extensionId = background.url().split('/')[2];
    console.log(`✓ Extension loaded with ID: ${extensionId}`);
  });
  
  test.afterAll(async () => {
    await context.close();
  });
  
  test('should load popup without errors', async () => {
    const page = await context.newPage();
    
    // Navigate to popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for popup to render
    await page.waitForSelector('#popup-root', { timeout: 10000 });
    
    // Check for any errors in console
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any errors
    await page.waitForTimeout(2000);
    
    if (errors.length > 0) {
      console.error('Console errors:', errors);
    }
    
    expect(errors.length).toBe(0);
    
    console.log('✓ Popup loaded without errors');
  });
  
  test('should render React app with header', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for React to render
    await page.waitForSelector('.popup-header', { timeout: 10000 });
    
    // Check for title
    const title = await page.locator('.popup-header h1').textContent();
    expect(title).toContain('Wordle');
    
    console.log('✓ React app rendered with header:', title);
  });
  
  test('should display time frame picker', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await page.waitForSelector('.time-frame-picker', { timeout: 10000 });
    
    // Check for time frame buttons
    const buttons = await page.locator('.time-frame-btn').count();
    expect(buttons).toBe(4); // 7d, 30d, 90d, all
    
    // Check button text
    const buttonTexts = await page.locator('.time-frame-btn').allTextContents();
    expect(buttonTexts).toContain('7D');
    expect(buttonTexts).toContain('30D');
    expect(buttonTexts).toContain('90D');
    expect(buttonTexts).toContain('ALL');
    
    console.log('✓ Time frame picker rendered with buttons:', buttonTexts);
  });
  
  test('should display loading or no-data state initially', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await page.waitForSelector('.popup-main', { timeout: 10000 });
    
    // Should show either loading, no-data, or stats
    const hasLoading = await page.locator('.loading').isVisible().catch(() => false);
    const hasNoData = await page.locator('.no-data').isVisible().catch(() => false);
    const hasStats = await page.locator('.stats-grid').isVisible().catch(() => false);
    
    expect(hasLoading || hasNoData || hasStats).toBe(true);
    
    console.log('✓ Popup showing state:', {
      loading: hasLoading,
      noData: hasNoData,
      stats: hasStats
    });
  });
  
  test('should have working dashboard button', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await page.waitForSelector('.dashboard-link', { timeout: 10000 });
    
    const dashboardBtn = page.locator('.dashboard-link');
    await expect(dashboardBtn).toBeVisible();
    
    const btnText = await dashboardBtn.textContent();
    expect(btnText).toContain('Dashboard');
    
    console.log('✓ Dashboard button present:', btnText);
  });
  
  test('should switch time frames', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await page.waitForSelector('.time-frame-picker', { timeout: 10000 });
    
    // Click 7D button
    await page.locator('.time-frame-btn').filter({ hasText: '7D' }).click();
    await page.waitForTimeout(500);
    
    // Check if 7D is active
    const activeBtn = await page.locator('.time-frame-btn.active').textContent();
    expect(activeBtn).toBe('7D');
    
    console.log('✓ Time frame switched to:', activeBtn);
  });
});
