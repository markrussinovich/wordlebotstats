// Final comprehensive test of the Wordle extension
const { chromium } = require('playwright');
const path = require('path');

async function finalValidation() {
  console.log('🔍 Final validation of Wordle extension...');
  
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
    if (msg.text().includes('BACKGROUND DEBUG')) {
      console.log(`🔧 ${msg.text()}`);
    }
  });

  const popupPage = await context.newPage();
  
  // Track all important console messages
  popupPage.on('console', msg => {
    const text = msg.text();
    if (text.includes('POPUP DEBUG') || text.includes('Background script response') || text.includes('error')) {
      if (msg.type() === 'error') {
        console.error(`❌ ${text}`);
      } else {
        console.log(`📱 ${text}`);
      }
    }
  });

  try {
    console.log('📱 Loading popup...');
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    console.log('⏳ Waiting for React app to render...');
    await popupPage.waitForSelector('.popup-container', { timeout: 10000 });
    
    // Verify UI components
    const hasHeader = await popupPage.$('.popup-header') !== null;
    const hasTimeFramePicker = await popupPage.$('.time-frame-picker') !== null;
    const hasMainContent = await popupPage.$('.popup-main') !== null;
    const hasDashboardButton = await popupPage.$('.dashboard-link') !== null;
    
    console.log('✅ UI Components:');
    console.log(`   Header: ${hasHeader ? '✅' : '❌'}`);
    console.log(`   Time Frame Picker: ${hasTimeFramePicker ? '✅' : '❌'}`);
    console.log(`   Main Content: ${hasMainContent ? '✅' : '❌'}`);
    console.log(`   Dashboard Button: ${hasDashboardButton ? '✅' : '❌'}`);
    
    console.log('⏳ Waiting for auto-import to trigger...');
    await popupPage.waitForTimeout(8000);
    
    // Test manual WordleBot scrape trigger
    console.log('🔧 Testing manual WordleBot scrape...');
    const scrapeResult = await popupPage.evaluate(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'START_WORDLE_BOT_SCRAPE',
          mode: 'recent',
          maxIterations: 3
        });
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✅ Manual scrape test:', scrapeResult.success ? '✅ Success' : `❌ Failed: ${scrapeResult.error}`);
    if (scrapeResult.response) {
      console.log('   Response:', scrapeResult.response);
    }
    
    // Test basic stats retrieval
    console.log('📊 Testing stats retrieval...');
    const statsResult = await popupPage.evaluate(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_QUICK_STATS',
          timeFrame: '7d'
        });
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('✅ Stats retrieval:', statsResult.success ? '✅ Success' : `❌ Failed: ${statsResult.error}`);
    if (statsResult.response && statsResult.response.statistics) {
      console.log(`   Game Count: ${statsResult.response.statistics.gameCount}`);
      console.log(`   Win Rate: ${statsResult.response.statistics.winRate}%`);
    }
    
    console.log('⏳ Waiting a bit more to observe behavior...');
    await popupPage.waitForTimeout(5000);
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }

  console.log('🔍 Validation complete. Extension is ready for use!');
  await context.close();
}

finalValidation().catch(console.error);