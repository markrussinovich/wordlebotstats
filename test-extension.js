import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testWordleExtension() {
  console.log('🎯 Starting Wordle extension test...');
  
  // Launch browser with extension
  const extensionPath = path.join(__dirname, 'dist');
  console.log('📂 Extension path:', extensionPath);
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--load-extension=${extensionPath}`,
      '--disable-extensions-except=' + extensionPath
    ]
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    const emoji = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'log' ? '📝' : '💬';
    console.log(`${emoji} [${type.toUpperCase()}] ${msg.text()}`);
  });
  
  try {
    console.log('🌐 Navigating to Wordle...');
    await page.goto('https://www.nytimes.com/games/wordle');
    await page.waitForTimeout(3000);
    
    console.log('🔍 Checking if content script loaded...');
    const contentScriptLoaded = await page.evaluate(() => {
      return typeof window !== 'undefined' && 
             window.console && 
             document.querySelector('game-app') !== null;
    });
    
    console.log('📋 Content script environment check:', contentScriptLoaded);
    
    // Check if extension is loaded
    console.log('🧩 Getting extension ID...');
    const extensionId = await getExtensionId(browser);
    console.log('🆔 Extension ID:', extensionId);
    
    if (extensionId) {
      // Open extension popup
      console.log('🚀 Opening extension popup...');
      const popupPage = await browser.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForTimeout(2000);
      
      // Check popup state
      const popupContent = await popupPage.textContent('body');
      console.log('📱 Popup content preview:', popupContent.substring(0, 200) + '...');
      
      // Open dashboard
      console.log('📊 Opening extension dashboard...');
      const dashboardPage = await browser.newPage();
      await dashboardPage.goto(`chrome-extension://${extensionId}/dashboard.html`);
      await dashboardPage.waitForTimeout(3000);
      
      // Check if debugWordle is available
      const debugAvailable = await dashboardPage.evaluate(() => {
        return typeof window.debugWordle !== 'undefined';
      });
      
      console.log('🛠️ Debug tools available:', debugAvailable);
      
      if (debugAvailable) {
        // Test storage check
        console.log('📦 Testing storage check...');
        const storageResult = await dashboardPage.evaluate(async () => {
          try {
            return await window.debugWordle.checkStorage();
          } catch (error) {
            return { error: error.message };
          }
        });
        
        console.log('📦 Storage check result:', JSON.stringify(storageResult, null, 2));
        
        // Test adding a game
        console.log('🎮 Testing game import...');
        const gameImportResult = await dashboardPage.evaluate(async () => {
          try {
            return await window.debugWordle.addTestGame();
          } catch (error) {
            return { error: error.message };
          }
        });
        
        console.log('🎮 Game import result:', JSON.stringify(gameImportResult, null, 2));
        
        // Check dashboard state after import
        await dashboardPage.waitForTimeout(2000);
        const dashboardState = await dashboardPage.evaluate(() => {
          const indicator = document.getElementById('data-type-indicator');
          const statCards = document.querySelectorAll('.stat-card .stat-value');
          
          return {
            statusText: indicator ? indicator.textContent : 'No status indicator',
            winRate: statCards[0] ? statCards[0].textContent : 'No win rate',
            totalGames: statCards[3] ? statCards[3].textContent : 'No game count'
          };
        });
        
        console.log('📊 Dashboard state:', JSON.stringify(dashboardState, null, 2));
      }
      
      // Test content script detection on Wordle page
      console.log('🔍 Testing content script on Wordle page...');
      await page.bringToFront();
      
      // Check if game elements exist
      const gameElements = await page.evaluate(() => {
        const gameApp = document.querySelector('game-app');
        const gameRows = document.querySelectorAll('game-row');
        const toaster = document.querySelector('game-toaster');
        
        return {
          hasGameApp: !!gameApp,
          gameRowCount: gameRows.length,
          hasToaster: !!toaster,
          gameAppHTML: gameApp ? gameApp.outerHTML.substring(0, 200) : 'No game app',
          location: window.location.href
        };
      });
      
      console.log('🎮 Wordle page analysis:', JSON.stringify(gameElements, null, 2));
      
      // Try to simulate game completion detection
      console.log('🎯 Testing game completion detection...');
      const detectionResult = await page.evaluate(() => {
        // Try to trigger the detection function if it exists
        if (window.detectGameCompletion) {
          try {
            window.detectGameCompletion();
            return { success: true, message: 'Detection function called' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        } else {
          return { success: false, message: 'Detection function not found' };
        }
      });
      
      console.log('🎯 Detection test result:', JSON.stringify(detectionResult, null, 2));
      
    } else {
      console.log('❌ Extension not loaded properly');
    }
    
    console.log('✅ Test completed. Check logs above for issues.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('🔍 Browser left open for manual inspection. Close when done.');
    // await browser.close();
  }
}

async function getExtensionId(browser) {
  try {
    const page = await browser.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(1000);
    
    const extensionId = await page.evaluate(() => {
      const cards = document.querySelectorAll('extensions-item');
      for (const card of cards) {
        const name = card.shadowRoot?.querySelector('#name')?.textContent;
        if (name && name.includes('Wordle')) {
          return card.getAttribute('id');
        }
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

// Run the test
testWordleExtension().catch(console.error);