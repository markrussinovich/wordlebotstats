import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function quickWordleCheck() {
  console.log('🔍 Quick Wordle DOM structure check...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🌐 Going to Wordle...');
    await page.goto('https://www.nytimes.com/games/wordle');
    await page.waitForTimeout(5000); // Wait longer for page to load
    
    console.log('🔍 Analyzing page structure...');
    const domAnalysis = await page.evaluate(() => {
      // Check various selectors that might contain the game
      const selectors = [
        'game-app',
        '[data-testid="wordle-app-game"]',
        '#wordle-app-game',
        '.Game-module_game',
        'div[class*="Game"]',
        'div[class*="wordle"]',
        'div[id*="wordle"]',
        'div[id*="game"]'
      ];
      
      const results = {};
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results[selector] = {
          count: elements.length,
          exists: elements.length > 0,
          html: elements.length > 0 ? elements[0].outerHTML.substring(0, 200) : null
        };
      });
      
      // Also check all elements with 'game' in class or id
      const allGameElements = [...document.querySelectorAll('*')].filter(el => {
        const className = el.className?.toString().toLowerCase() || '';
        const id = el.id?.toLowerCase() || '';
        const tagName = el.tagName?.toLowerCase() || '';
        return className.includes('game') || id.includes('game') || tagName.includes('game');
      });
      
      results['elements_with_game'] = {
        count: allGameElements.length,
        elements: allGameElements.slice(0, 5).map(el => ({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          html: el.outerHTML.substring(0, 100)
        }))
      };
      
      // Check page title and URL
      results['page_info'] = {
        title: document.title,
        url: window.location.href,
        readyState: document.readyState
      };
      
      // Check if we're behind paywall or auth
      const authElements = document.querySelectorAll('[class*="auth"], [class*="login"], [class*="subscribe"], .nytimes-vi');
      results['auth_indicators'] = {
        count: authElements.length,
        exists: authElements.length > 0,
        texts: [...authElements].slice(0, 3).map(el => el.textContent?.substring(0, 50))
      };
      
      return results;
    });
    
    console.log('📊 DOM Analysis Results:');
    console.log(JSON.stringify(domAnalysis, null, 2));
    
    // Try to wait for specific game elements
    console.log('⏳ Waiting for game elements to load...');
    try {
      await page.waitForSelector('game-app, [data-testid*="game"], [id*="game"], [class*="Game"]', { timeout: 10000 });
      console.log('✅ Game elements found!');
    } catch (error) {
      console.log('❌ No game elements found after 10s timeout');
    }
    
    // Check if we need to interact with the page (scroll, click, etc.)
    console.log('🖱️ Trying page interactions...');
    await page.mouse.move(400, 300);
    await page.click('body');
    await page.waitForTimeout(2000);
    
    // Check again after interaction
    const postInteractionCheck = await page.evaluate(() => {
      const gameApp = document.querySelector('game-app');
      const gameRows = document.querySelectorAll('game-row');
      return {
        gameAppFound: !!gameApp,
        gameRowsCount: gameRows.length,
        bodyClasses: document.body.className,
        htmlContent: document.documentElement.outerHTML.substring(0, 500)
      };
    });
    
    console.log('🔄 Post-interaction check:', JSON.stringify(postInteractionCheck, null, 2));
    
  } catch (error) {
    console.error('❌ Error during check:', error);
  } finally {
    console.log('🔍 Browser left open for manual inspection...');
    // await browser.close();
  }
}

quickWordleCheck().catch(console.error);