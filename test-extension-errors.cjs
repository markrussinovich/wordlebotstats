// Test script to capture extension errors
const { chromium } = require('playwright');
const path = require('path');

async function testExtensionErrors() {
  console.log('Testing extension for errors...');
  
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
  
  // Test background script directly
  console.log('Testing background script...');
  background.on('console', msg => {
    console.log(`🔧 BACKGROUND: ${msg.text()}`);
  });
  
  try {
    const bgResponse = await background.evaluate(() => {
      console.log('[BACKGROUND TEST] Testing message handling...');
      return 'Background script is running';
    });
    console.log('✓ Background script accessible:', bgResponse);
  } catch (error) {
    console.error('🔴 Background script error:', error.message);
  }

  const page = await context.newPage();
  
  // Capture all console messages
  const allMessages = [];
  page.on('console', msg => {
    const message = `${msg.type().toUpperCase()}: ${msg.text()}`;
    allMessages.push(message);
    if (msg.type() === 'error') {
      console.error('🔴 ERROR:', msg.text());
    } else if (msg.type() === 'warning') {
      console.warn('🟡 WARNING:', msg.text());
    } else {
      console.log('📝 Console:', msg.text());
    }
  });

  // Capture unhandled errors
  page.on('pageerror', error => {
    console.error('🔴 PAGE ERROR:', error.message);
    allMessages.push(`PAGE ERROR: ${error.message}`);
  });

  try {
    console.log('Loading popup...');
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    console.log('Waiting for popup to render...');
    await page.waitForSelector('#popup-root', { timeout: 10000 });
    
    console.log('Waiting for React app to initialize...');
    await page.waitForTimeout(5000);
    
    // Check if React component rendered
    const hasContent = await page.$('.popup-container') !== null;
    console.log('✓ React app rendered:', hasContent);
    
    // Check for specific elements
    const hasHeader = await page.$('.popup-header') !== null;
    const hasTimeFramePicker = await page.$('.time-frame-picker') !== null;
    const hasMainContent = await page.$('.popup-main') !== null;
    const hasFooter = await page.$('.popup-footer') !== null;
    
    console.log('Component check:');
    console.log('  - Header:', hasHeader);
    console.log('  - Time frame picker:', hasTimeFramePicker);
    console.log('  - Main content:', hasMainContent);
    console.log('  - Footer:', hasFooter);
    
    // Test background script
    console.log('Testing background script...');
    try {
      const response = await page.evaluate(() => {
        return chrome.runtime.sendMessage({
          type: 'GET_QUICK_STATS',
          timeFrame: '7d'
        });
      });
      console.log('✓ Background script response:', response);
    } catch (error) {
      console.error('🔴 Background script error:', error.message);
    }
    
  } catch (error) {
    console.error('🔴 Test failed:', error.message);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total console messages: ${allMessages.length}`);
  const errors = allMessages.filter(msg => msg.startsWith('ERROR:') || msg.startsWith('PAGE ERROR:'));
  const warnings = allMessages.filter(msg => msg.startsWith('WARNING:'));
  
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n🔴 ALL ERRORS:');
    errors.forEach(error => console.log(`  ${error}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n🟡 ALL WARNINGS:');
    warnings.forEach(warning => console.log(`  ${warning}`));
  }

  await context.close();
}

testExtensionErrors().catch(console.error);