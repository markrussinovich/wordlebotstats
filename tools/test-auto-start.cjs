// Test script to debug auto-start functionality
const { chromium } = require('playwright');
const path = require('path');

async function testAutoStart() {
  console.log('🔍 Testing auto-start functionality...');
  
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
  console.log(`✅ Extension loaded with ID: ${extensionId}`);
  
  // Monitor background script
  background.on('console', msg => {
    console.log(`🔧 BACKGROUND: ${msg.text()}`);
  });

  const popupPage = await context.newPage();
  
  // Monitor popup messages
  popupPage.on('console', msg => {
    if (msg.text().includes('POPUP DEBUG') || msg.text().includes('triggerAutoImport')) {
      console.log(`📱 POPUP: ${msg.text()}`);
    }
  });

  try {
    console.log('📱 Loading popup to trigger auto-import...');
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    console.log('⏳ Waiting for popup to initialize...');
    await popupPage.waitForSelector('.popup-container', { timeout: 10000 });
    
    console.log('⏳ Waiting for auto-import to trigger...');
    await popupPage.waitForTimeout(10000); // Wait for auto-import timeout
    
    // Now create WordleBot page to see if content script gets the parameters
    console.log('🌐 Creating WordleBot page...');
    const wordleBotPage = await context.newPage();
    
    // Monitor content script messages
    wordleBotPage.on('console', msg => {
      console.log(`📝 CONTENT: ${msg.text()}`);
    });
    
    console.log('🌐 Navigating to WordleBot...');
    await wordleBotPage.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
    
    console.log('⏳ Waiting for content script to process...');
    await wordleBotPage.waitForTimeout(10000);
    
    // Check storage to see if parameters were set
    console.log('💾 Checking storage for scrape parameters...');
    const storage = await popupPage.evaluate(async () => {
      const result = await chrome.storage.local.get(['wordleBotScrapeParams', 'games']);
      return result;
    });
    
    console.log('💾 Storage contents:', storage);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🔍 Test complete. Keeping browser open for inspection...');
  await popupPage.waitForTimeout(30000);
  
  await context.close();
}

testAutoStart().catch(console.error);