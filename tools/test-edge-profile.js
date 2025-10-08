import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testWithEdgeProfile() {
  console.log('🔍 Testing Wordle extension with your Edge profile...');
  
  // Edge user data paths for different OS
  const edgeUserDataPaths = {
    'win32': path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data'),
    'darwin': path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge'),
    'linux': path.join(os.homedir(), '.config', 'microsoft-edge')
  };
  
  const userDataDir = edgeUserDataPaths[os.platform()];
  const profilePath = path.join(userDataDir, 'Default'); // Usually the personal profile
  
  console.log('📂 Using Edge profile:', profilePath);
  
  const extensionPath = path.join(__dirname, 'dist');
  console.log('📂 Extension path:', extensionPath);
  
  try {
    // Launch with your Edge profile
    const browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'msedge', // Use actual Edge browser
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--profile-directory=Default' // Use your personal profile
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
    
    console.log('🌐 Navigating to Wordle with your authenticated session...');
    await page.goto('https://www.nytimes.com/games/wordle');
    await page.waitForTimeout(5000); // Wait for page to fully load
    
    // Check authentication status
    const authStatus = await page.evaluate(() => {
      const authElements = document.querySelectorAll('[class*="auth"], [class*="login"], [class*="subscribe"]');
      const gameApp = document.querySelector('game-app');
      
      return {
        isAuthenticated: authElements.length === 0,
        hasGameApp: !!gameApp,
        pageTitle: document.title,
        url: window.location.href,
        bodyClasses: document.body.className,
        authElementCount: authElements.length
      };
    });
    
    console.log('🔐 Authentication Status:', JSON.stringify(authStatus, null, 2));
    
    if (authStatus.isAuthenticated && authStatus.hasGameApp) {
      console.log('✅ Successfully authenticated and game loaded!');
      
      // Check if content script is working
      const contentScriptStatus = await page.evaluate(() => {
        return {
          debugFunctionsAvailable: typeof window.wordleExtensionDebug !== 'undefined',
          contentScriptLoaded: document.body.textContent.includes('Wordle Stat Explorer') || 
                              window.console.toString().includes('Wordle'),
          gameElements: {
            gameApp: !!document.querySelector('game-app'),
            gameRows: document.querySelectorAll('game-row').length,
            gameToaster: !!document.querySelector('game-toaster')
          }
        };
      });
      
      console.log('📝 Content Script Status:', JSON.stringify(contentScriptStatus, null, 2));
      
      // Test the debug functions
      if (contentScriptStatus.debugFunctionsAvailable) {
        console.log('🛠️ Testing debug functions...');
        
        const debugResults = await page.evaluate(() => {
          return {
            authCheck: window.wordleExtensionDebug.checkAuth(),
            gameElements: window.wordleExtensionDebug.findGameElements(),
            forceDetection: window.wordleExtensionDebug.forceDetection()
          };
        });
        
        console.log('🔧 Debug Results:', JSON.stringify(debugResults, null, 2));
        
        // Test import functionality
        console.log('🧪 Testing game import...');
        await page.evaluate(() => {
          window.wordleExtensionDebug.testImport();
        });
        
        await page.waitForTimeout(2000);
      }
      
      // Get extension ID and test dashboard
      console.log('🧩 Finding extension...');
      const extensionId = await getExtensionId(browser);
      
      if (extensionId) {
        console.log('🆔 Extension ID:', extensionId);
        
        // Test popup
        console.log('📱 Testing popup...');
        const popupPage = await browser.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
        await popupPage.waitForTimeout(2000);
        
        const popupStats = await popupPage.evaluate(() => {
          const elements = {
            winRate: document.querySelector('.win-rate')?.textContent,
            streak: document.querySelector('.streak')?.textContent,
            games: document.querySelector('.games')?.textContent,
            statusMessage: document.body.textContent.includes('Loading') ? 'Loading' : 
                          document.body.textContent.includes('No data') ? 'No data' : 'Has data'
          };
          return elements;
        });
        
        console.log('📱 Popup Stats:', JSON.stringify(popupStats, null, 2));
        
        // Test dashboard
        console.log('📊 Testing dashboard...');
        const dashboardPage = await browser.newPage();
        await dashboardPage.goto(`chrome-extension://${extensionId}/dashboard.html`);
        await dashboardPage.waitForTimeout(3000);
        
        const dashboardDebugAvailable = await dashboardPage.evaluate(() => {
          return typeof window.debugWordle !== 'undefined';
        });
        
        console.log('🛠️ Dashboard debug available:', dashboardDebugAvailable);
        
        if (dashboardDebugAvailable) {
          const dashboardTests = await dashboardPage.evaluate(async () => {
            const results = {
              storageCheck: await window.debugWordle.checkStorage(),
              // Don't add test game yet, let's see real data first
            };
            return results;
          });
          
          console.log('📊 Dashboard Tests:', JSON.stringify(dashboardTests, null, 2));
          
          // Check dashboard UI state
          const dashboardState = await dashboardPage.evaluate(() => {
            return {
              statusIndicator: document.getElementById('data-type-indicator')?.textContent,
              winRateValue: document.querySelector('.stat-card .stat-value')?.textContent,
              hasCharts: {
                trendCanvas: !!document.getElementById('trend-canvas'),
                distributionCanvas: !!document.getElementById('distribution-canvas')
              }
            };
          });
          
          console.log('📊 Dashboard UI State:', JSON.stringify(dashboardState, null, 2));
        }
      }
      
    } else {
      console.log('❌ Authentication or game loading failed');
      if (!authStatus.isAuthenticated) {
        console.log('🔐 Not authenticated - you may need to log in manually');
      }
      if (!authStatus.hasGameApp) {
        console.log('🎮 Game app not found - Wordle may not have loaded');
      }
    }
    
    console.log('✅ Test completed. Browser left open for manual inspection.');
    console.log('💡 In the Wordle page console, try: window.wordleExtensionDebug.testImport()');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function getExtensionId(browser) {
  try {
    const page = await browser.newPage();
    await page.goto('edge://extensions/');
    await page.waitForTimeout(2000);
    
    const extensionId = await page.evaluate(() => {
      // Edge extensions page structure
      const items = document.querySelectorAll('extensions-item, [id*="extension"]');
      for (const item of items) {
        const nameEl = item.shadowRoot?.querySelector('.name') || 
                      item.querySelector('[class*="name"]') ||
                      item.querySelector('h3, h2, .title');
        
        const name = nameEl?.textContent || '';
        if (name.toLowerCase().includes('wordle')) {
          return item.getAttribute('id') || item.dataset.id;
        }
      }
      
      // Fallback: look for any element containing wordle extension info
      const allText = document.body.textContent.toLowerCase();
      if (allText.includes('wordle stat explorer')) {
        const matches = document.body.innerHTML.match(/([a-z]{32})/g);
        return matches ? matches[0] : null;
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

testWithEdgeProfile().catch(console.error);