// Test script specifically for WordleBot scraping functionality
const { chromium } = require('playwright');
const path = require('path');

async function testWordleBotScrape() {
  console.log('Testing WordleBot scraping functionality...');
  
  const pathToExtension = path.resolve(__dirname, './dist');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  let extensionId;
  let [background] = context.serviceWorkers();
  if (!background) background = await context.waitForEvent('serviceworker');
  
  extensionId = background.url().split('/')[2];
  console.log(`✓ Extension loaded with ID: ${extensionId}`);
  
  // Listen to background script messages
  background.on('console', msg => {
    console.log(`🔧 BACKGROUND: ${msg.text()}`);
  });

  const page = await context.newPage();
  
  // Capture all console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('🔴 POPUP ERROR:', msg.text());
    } else {
      console.log('📝 POPUP:', msg.text());
    }
  });

  try {
    console.log('Loading popup...');
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    console.log('Waiting for popup to render...');
    await page.waitForSelector('#popup-root', { timeout: 10000 });
    
    console.log('Waiting for React app to initialize...');
    await page.waitForTimeout(3000);
    
    console.log('Manually triggering WordleBot scrape...');
    const response = await page.evaluate(async () => {
      console.log('[TEST] Sending START_WORDLE_BOT_SCRAPE message...');
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'START_WORDLE_BOT_SCRAPE',
          mode: 'recent',
          maxIterations: 5
        });
        console.log('[TEST] Background response:', result);
        return result;
      } catch (error) {
        console.error('[TEST] Error sending message:', error);
        return { success: false, error: error.message };
      }
    });
    
    console.log('✓ WordleBot scrape response:', response);
    
    if (response.success) {
      console.log('Waiting for scrape to complete...');
      await page.waitForTimeout(15000); // Wait for scraping process
    }
    
  } catch (error) {
    console.error('🔴 Test failed:', error.message);
  }

  // Keep browser open for manual inspection
  console.log('Test complete. Keeping browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await context.close();
}

testWordleBotScrape().catch(console.error);