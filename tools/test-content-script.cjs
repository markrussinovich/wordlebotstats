// Test script to monitor content script behavior
const { chromium } = require('playwright');
const path = require('path');

async function testContentScript() {
  console.log('Testing content script behavior...');
  
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

  // Create WordleBot page directly to test content script
  console.log('Creating WordleBot page...');
  const wordleBotPage = await context.newPage();
  
  // Listen to content script messages
  wordleBotPage.on('console', msg => {
    console.log(`📝 CONTENT: ${msg.text()}`);
  });

  try {
    console.log('Navigating to WordleBot page...');
    await wordleBotPage.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
    
    console.log('Waiting for page to load...');
    await wordleBotPage.waitForLoadState('networkidle');
    
    console.log('Waiting for content script to initialize...');
    await wordleBotPage.waitForTimeout(5000);
    
    console.log('Setting scrape parameters manually...');
    await wordleBotPage.evaluate(async () => {
      await chrome.storage.local.set({
        wordleBotScrapeParams: {
          mode: 'recent',
          maxIterations: 5,
          timestamp: Date.now()
        }
      });
      console.log('[TEST] Scrape parameters set');
    });
    
    console.log('Waiting for auto-start...');
    await wordleBotPage.waitForTimeout(3000);
    
    console.log('Checking storage...');
    const storage = await wordleBotPage.evaluate(async () => {
      const result = await chrome.storage.local.get(['wordleBotScrapeParams']);
      console.log('[TEST] Storage check result:', result);
      return result;
    });
    
    console.log('Storage result:', storage);
    
  } catch (error) {
    console.error('🔴 Test failed:', error.message);
  }

  console.log('Test complete. Keeping browser open for 15 seconds...');
  await wordleBotPage.waitForTimeout(15000);
  
  await context.close();
}

testContentScript().catch(console.error);