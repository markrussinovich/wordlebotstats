import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Popup UI Display Tests', () => {
  let context: BrowserContext;
  let extensionId: string;
  
  test.beforeAll(async () => {
    const pathToExtension = path.resolve(__dirname, '../../dist');
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    
    extensionId = background.url().split('/')[2];
    console.log(`✓ Extension loaded with ID: ${extensionId}`);
  });
  
  test.afterAll(async () => {
    await context.close();
  });
  
  test('should NOT show duplicate "Checking for latest games" messages', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for popup to render
    await page.waitForSelector('.popup-header', { timeout: 5000 });
    
    // Get all text content in the popup
    const allText = await page.locator('body').textContent();
    
    // Count occurrences of "Checking for latest games"
    const checkingMatches = allText?.match(/Checking for latest games/gi) || [];
    const occurrences = checkingMatches.length;
    
    console.log(`✓ "Checking for latest games" appears ${occurrences} time(s)`);
    console.log('✓ Full popup text (first 500 chars):', allText?.slice(0, 500));
    
    // Should appear at most once (might be 0 if it transitions quickly, or 1 if we catch it)
    expect(occurrences).toBeLessThanOrEqual(1);
    
    if (occurrences > 1) {
      console.error('❌ DUPLICATE MESSAGE DETECTED!');
      console.error('Full text:', allText);
    }
  });
  
  test('should show clean initial state without HTML loading artifacts', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait briefly for React to mount
    await page.waitForTimeout(500);
    
    const bodyText = await page.locator('body').textContent();
    
    // Should NOT contain the old HTML loading messages
    expect(bodyText).not.toContain('Initializing extension...');
    expect(bodyText).not.toContain('Loading modules...');
    expect(bodyText).not.toContain('Connecting to storage...');
    
    console.log('✓ No HTML loading artifacts present');
  });
  
  test('should transition smoothly from initial load to React app', async () => {
    const page = await context.newPage();
    
    // Track what's visible over time
    const visibleStates: string[] = [];
    
    page.on('console', msg => {
      if (msg.text().includes('Popup') || msg.text().includes('React')) {
        visibleStates.push(msg.text());
      }
    });
    
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for React to fully mount
    await page.waitForSelector('.popup-header', { timeout: 5000 });
    
    console.log('✓ Transition states:', visibleStates);
    
    // Should see React mounting messages
    const hasReactMount = visibleStates.some(s => s.includes('React entry point') || s.includes('Mounting React'));
    expect(hasReactMount).toBe(true);
    
    console.log('✓ Smooth transition confirmed');
  });
  
  test('should display only ONE loading/checking message at a time', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for initial render
    await page.waitForSelector('.popup-header', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Count all loading-related messages
    const loadingDivs = await page.locator('.loading, [role="status"]').count();
    
    console.log(`✓ Found ${loadingDivs} loading indicator(s)`);
    
    // Should have at most 1 loading indicator visible
    expect(loadingDivs).toBeLessThanOrEqual(1);
  });
  
  test('should show progress updates sequentially (not overlapping)', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    await page.waitForSelector('.popup-header', { timeout: 5000 });
    
    // Wait and capture different states
    const states: Array<{ time: number; text: string }> = [];
    
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      const text = await page.locator('.popup-main').textContent();
      if (text) {
        states.push({ time: i * 500, text: text.trim().slice(0, 100) });
      }
    }
    
    console.log('✓ State progression:');
    states.forEach(s => console.log(`  ${s.time}ms: ${s.text}`));
    
    // Verify no state contains multiple status messages at once
    states.forEach(state => {
      const hasMultipleStates = 
        (state.text.includes('Checking') && state.text.includes('Importing')) ||
        (state.text.includes('Checking') && state.text.includes('Loading')) ||
        (state.text.includes('Importing') && state.text.includes('Loading'));
      
      expect(hasMultipleStates).toBe(false);
    });
    
    console.log('✓ No overlapping states detected');
  });
});
