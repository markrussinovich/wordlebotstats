import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testWithChromeLogin() {
  console.log('🔍 Testing Wordle extension with Chrome - you can log in manually...');
  
  const extensionPath = path.join(__dirname, 'dist');
  console.log('📂 Extension path:', extensionPath);
  
  try {
    // Launch Chrome with extension loaded
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });
    
    const page = await browser.newPage();
    
    // Enhanced console logging
    page.on('console', msg => {
      const type = msg.type();
      const emoji = type === 'error' ? '❌' : 
                   type === 'warn' ? '⚠️' : 
                   type === 'log' ? '📝' : 
                   type === 'info' ? 'ℹ️' : '💬';
      console.log(`${emoji} [${type.toUpperCase()}] ${msg.text()}`);
    });
    
    console.log('🌐 Opening Wordle page...');
    console.log('👤 Please log into your NY Times account manually in the browser');
    console.log('🎮 Then play or view a completed Wordle game');
    console.log('⏱️  I\'ll wait 30 seconds for you to log in, then start testing...');
    
    await page.goto('https://www.nytimes.com/games/wordle');
    
    // Wait for manual login
    await page.waitForTimeout(30000); // 30 seconds to log in
    
    console.log('🔍 Starting automated testing...');
    
    // Check authentication status
    const authStatus = await page.evaluate(() => {
      const authElements = document.querySelectorAll('[class*="auth"], [class*="login"], [class*="subscribe"]');
      const gameApp = document.querySelector('game-app');
      const gameRows = document.querySelectorAll('game-row');
      
      return {
        isAuthenticated: authElements.length === 0,
        hasGameApp: !!gameApp,
        gameRowsCount: gameRows.length,
        pageTitle: document.title,
        url: window.location.href,
        authElementCount: authElements.length,
        hasWordleInTitle: document.title.toLowerCase().includes('wordle')
      };
    });
    
    console.log('🔐 Authentication & Game Status:', JSON.stringify(authStatus, null, 2));
    
    // Check content script status
    const contentScriptStatus = await page.evaluate(() => {
      return {
        debugFunctionsAvailable: typeof window.wordleExtensionDebug !== 'undefined',
        gameElements: {
          gameApp: !!document.querySelector('game-app'),
          gameRows: document.querySelectorAll('game-row').length,
          gameToaster: !!document.querySelector('game-toaster'),
          gameBoard: !!document.querySelector('[data-testid="board"], .Board-module_board')
        },
        pageInfo: {
          title: document.title,
          readyState: document.readyState,
          bodyClasses: document.body.className
        }
      };
    });
    
    console.log('📝 Content Script Status:', JSON.stringify(contentScriptStatus, null, 2));
    
    if (contentScriptStatus.debugFunctionsAvailable) {
      console.log('🛠️ Testing content script debug functions...');
      
      const debugResults = await page.evaluate(() => {
        const results = {};
        try {
          results.authCheck = window.wordleExtensionDebug.checkAuth();
          results.gameElements = window.wordleExtensionDebug.findGameElements();
          // Force detection
          window.wordleExtensionDebug.forceDetection();
          results.detectionForced = true;
        } catch (error) {
          results.error = error.message;
        }
        return results;
      });
      
      console.log('🔧 Content Script Debug Results:', JSON.stringify(debugResults, null, 2));
      
    } else {
      console.log('❌ Content script debug functions not available');
      console.log('🔄 Trying to reload content script...');
      await page.reload();
      await page.waitForTimeout(3000);
    }
    
    // Get extension ID
    console.log('🧩 Finding extension...');
    const extensionId = await getExtensionId(browser);
    
    if (extensionId) {
      console.log('🆔 Extension ID:', extensionId);
      
      // Test popup
      console.log('📱 Testing popup...');
      const popupPage = await browser.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForTimeout(3000);
      
      const popupState = await popupPage.evaluate(() => {
        return {
          bodyText: document.body.textContent.substring(0, 500),
          hasStats: !!document.querySelector('.stats, .stat-card, [class*="stat"]'),
          hasButtons: !!document.querySelector('button'),
          winRateText: document.body.textContent.match(/win rate[:\s]*([0-9.%]+)/i)?.[1] || 'Not found',
          loadingState: document.body.textContent.toLowerCase().includes('loading') ? 'Loading' :
                       document.body.textContent.toLowerCase().includes('no data') ? 'No data' :
                       document.body.textContent.toLowerCase().includes('0.0%') ? 'Zero stats' : 'Has data'
        };
      });
      
      console.log('📱 Popup State:', JSON.stringify(popupState, null, 2));
      
      // Test dashboard
      console.log('📊 Testing dashboard...');
      const dashboardPage = await browser.newPage();
      await dashboardPage.goto(`chrome-extension://${extensionId}/dashboard.html`);
      await dashboardPage.waitForTimeout(5000);
      
      const dashboardDebugAvailable = await dashboardPage.evaluate(() => {
        return typeof window.debugWordle !== 'undefined';
      });
      
      console.log('🛠️ Dashboard debug available:', dashboardDebugAvailable);
      
      if (dashboardDebugAvailable) {
        console.log('🔍 Testing dashboard debug functions...');
        
        const dashboardTests = await dashboardPage.evaluate(async () => {
          try {
            const storageResult = await window.debugWordle.checkStorage();
            return {
              storageCheck: storageResult,
              storageSuccess: true
            };
          } catch (error) {
            return {
              storageError: error.message,
              storageSuccess: false
            };
          }
        });
        
        console.log('📦 Storage Test Results:', JSON.stringify(dashboardTests, null, 2));
        
        // Test adding a game to verify the system works
        console.log('🧪 Testing game import functionality...');
        const importTest = await dashboardPage.evaluate(async () => {
          try {
            const result = await window.debugWordle.addTestGame();
            return { importSuccess: true, result };
          } catch (error) {
            return { importSuccess: false, error: error.message };
          }
        });
        
        console.log('🎮 Import Test Results:', JSON.stringify(importTest, null, 2));
        
        // Check dashboard state after test
        await dashboardPage.waitForTimeout(2000);
        const finalDashboardState = await dashboardPage.evaluate(() => {
          return {
            statusIndicator: document.getElementById('data-type-indicator')?.textContent,
            winRateValue: document.querySelector('.stat-card .stat-value')?.textContent,
            totalGamesValue: document.querySelectorAll('.stat-card .stat-value')[3]?.textContent,
            hasCanvas: !!document.getElementById('trend-canvas')
          };
        });
        
        console.log('📊 Final Dashboard State:', JSON.stringify(finalDashboardState, null, 2));
        
      } else {
        console.log('❌ Dashboard debug functions not available');
      }
      
    } else {
      console.log('❌ Could not find extension ID');
    }
    
    console.log('✅ Testing completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`Authentication: ${authStatus.isAuthenticated ? '✅ Logged in' : '❌ Not logged in'}`);
    console.log(`Game App: ${authStatus.hasGameApp ? '✅ Found' : '❌ Not found'}`);
    console.log(`Content Script: ${contentScriptStatus.debugFunctionsAvailable ? '✅ Working' : '❌ Not working'}`);
    console.log(`Extension: ${extensionId ? '✅ Loaded' : '❌ Not found'}`);
    console.log('');
    console.log('💡 The browser is left open for manual inspection.');
    console.log('💡 Try playing a Wordle game and check if the extension detects it!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function getExtensionId(browser) {
  try {
    const page = await browser.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(1000);
    
    const extensionId = await page.evaluate(() => {
      // Look for extension cards
      const items = document.querySelectorAll('extensions-item');
      for (const item of items) {
        const nameEl = item.shadowRoot?.querySelector('#name, .name');
        const name = nameEl?.textContent || '';
        if (name.toLowerCase().includes('wordle')) {
          return item.getAttribute('id');
        }
      }
      
      // Alternative method - look in the URL or HTML
      const pageContent = document.body.innerHTML;
      const matches = pageContent.match(/([a-z]{32})/g);
      if (matches) {
        // Return the first 32-character lowercase string (typical extension ID format)
        return matches[0];
      }
      
      return null;
    });
    
    await page.close();
    return extensionId;
  } catch (error) {
    console.error('Error getting extension ID:', error);
    return null;
  }
}

testWithChromeLogin().catch(console.error);