import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testWithEdge() {
  console.log('🔍 Launching Edge browser for manual login and testing...');
  
  const extensionPath = path.join(__dirname, 'dist');
  console.log('📂 Extension path:', extensionPath);
  
  try {
    // Launch Edge in a more natural way to avoid bot detection
    const browser = await chromium.launch({
      headless: false,
      channel: 'msedge', // Use actual Edge browser
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-web-security', // Sometimes helps with extension loading
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' // Natural user agent
      ]
    });
    
    const page = await browser.newPage();
    
    // Remove automation indicators that might trigger bot detection
    await page.addInitScript(() => {
      // Remove webdriver property
      delete navigator.webdriver;
      
      // Override the plugins property
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5] // Fake plugins
      });
      
      // Override the languages property
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
    
    // Enhanced console logging - only show extension-related messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Wordle Stat Explorer') || 
          text.includes('🎯') || 
          text.includes('🎮') || 
          text.includes('📝') ||
          text.includes('Debug functions')) {
        const type = msg.type();
        const emoji = type === 'error' ? '❌' : 
                     type === 'warn' ? '⚠️' : 
                     type === 'log' ? '📝' : 
                     type === 'info' ? 'ℹ️' : '💬';
        console.log(`${emoji} [EXTENSION] ${text}`);
      }
    });
    
    console.log('🌐 Opening Wordle page in Edge...');
    console.log('');
    console.log('🚨 IMPORTANT INSTRUCTIONS:');
    console.log('1. 👤 Log into your NY Times account in the browser');
    console.log('2. 🎮 Navigate to Wordle and play/view a game');
    console.log('3. 📱 Open the extension popup (click the extension icon)');
    console.log('4. 📊 Try opening the dashboard from the popup');
    console.log('5. 🛠️ Open browser DevTools (F12) and check console for extension messages');
    console.log('');
    console.log('⏱️  I\'ll wait 2 minutes for you to log in and test, then run automated checks...');
    
    await page.goto('https://www.nytimes.com/games/wordle');
    
    // Wait 2 minutes for manual testing
    await page.waitForTimeout(120000); // 2 minutes
    
    console.log('🔍 Starting automated analysis...');
    
    // Check current page state
    const pageAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasGameApp: !!document.querySelector('game-app'),
        hasAuthElements: document.querySelectorAll('[class*="auth"], [class*="login"], [class*="subscribe"]').length,
        gameRows: document.querySelectorAll('game-row').length,
        hasWordleContent: document.body.textContent.toLowerCase().includes('wordle'),
        debugAvailable: typeof window.wordleExtensionDebug !== 'undefined',
        readyState: document.readyState
      };
    });
    
    console.log('📊 Page Analysis:', JSON.stringify(pageAnalysis, null, 2));
    
    // Test content script functions if available
    if (pageAnalysis.debugAvailable) {
      console.log('🛠️ Testing content script functions...');
      
      const contentTests = await page.evaluate(() => {
        try {
          return {
            authCheck: window.wordleExtensionDebug.checkAuth(),
            gameElements: window.wordleExtensionDebug.findGameElements(),
            testImportAvailable: typeof window.wordleExtensionDebug.testImport === 'function'
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('🔧 Content Script Tests:', JSON.stringify(contentTests, null, 2));
      
      // Test import if user wants to
      console.log('');
      console.log('🧪 To test game import manually, run this in the browser console:');
      console.log('   window.wordleExtensionDebug.testImport()');
      console.log('');
    }
    
    // Try to find extension ID and test extension pages
    console.log('🔍 Looking for extension...');
    
    // Check if we can access extension pages
    try {
      const extensionPage = await browser.newPage();
      await extensionPage.goto('edge://extensions/');
      await extensionPage.waitForTimeout(2000);
      
      const extensionInfo = await extensionPage.evaluate(() => {
        const items = document.querySelectorAll('extensions-item');
        for (const item of items) {
          const nameEl = item.shadowRoot?.querySelector('.name, #name') ||
                        item.querySelector('[class*="name"], h3, h2');
          const name = nameEl?.textContent || '';
          if (name.toLowerCase().includes('wordle')) {
            return {
              found: true,
              name: name,
              id: item.getAttribute('id') || 'unknown',
              enabled: !item.hasAttribute('disabled')
            };
          }
        }
        return { found: false };
      });
      
      console.log('🧩 Extension Info:', JSON.stringify(extensionInfo, null, 2));
      
      if (extensionInfo.found && extensionInfo.id !== 'unknown') {
        const extensionId = extensionInfo.id;
        
        // Test popup
        console.log('📱 Testing popup...');
        try {
          const popupPage = await browser.newPage();
          await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
          await popupPage.waitForTimeout(3000);
          
          const popupContent = await popupPage.textContent('body');
          console.log('📱 Popup content preview:', popupContent.substring(0, 200));
          
          await popupPage.close();
        } catch (error) {
          console.log('❌ Could not test popup:', error.message);
        }
        
        // Test dashboard
        console.log('📊 Testing dashboard...');
        try {
          const dashboardPage = await browser.newPage();
          await dashboardPage.goto(`chrome-extension://${extensionId}/dashboard.html`);
          await dashboardPage.waitForTimeout(3000);
          
          const dashboardDebug = await dashboardPage.evaluate(() => {
            return typeof window.debugWordle !== 'undefined';
          });
          
          console.log('🛠️ Dashboard debug available:', dashboardDebug);
          
          if (dashboardDebug) {
            const storageTest = await dashboardPage.evaluate(async () => {
              try {
                return await window.debugWordle.checkStorage();
              } catch (error) {
                return { error: error.message };
              }
            });
            
            console.log('📦 Storage test:', JSON.stringify(storageTest, null, 2));
          }
          
          // Don't close dashboard - leave it open for user
          console.log('📊 Dashboard page left open for inspection');
          
        } catch (error) {
          console.log('❌ Could not test dashboard:', error.message);
        }
      }
      
      await extensionPage.close();
      
    } catch (error) {
      console.log('❌ Could not access extension management:', error.message);
    }
    
    console.log('');
    console.log('✅ Testing completed!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. 🎮 If logged in and game loaded, try playing Wordle');
    console.log('2. 🔍 Check browser console (F12) for extension messages');
    console.log('3. 📱 Test the extension popup and dashboard');
    console.log('4. 🧪 Use window.wordleExtensionDebug.testImport() to test import');
    console.log('');
    console.log('🔍 Browser left open for continued testing...');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWithEdge().catch(console.error);