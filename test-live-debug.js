/**
 * Debug test - connects to existing browser to see what's happening
 */

import { chromium } from 'playwright';

async function debugLiveBrowser() {
  console.log('🔍 Debugging live browser session...\n');
  
  let browser;
  
  try {
    console.log('⚡ Starting Edge with remote debugging...');
    console.log('📋 Make sure Edge is running with:');
    console.log('   "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9223 --user-data-dir="C:\\temp\\edge-debug-new"');
    console.log('   And navigate to: https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html\n');
    
    // Connect to existing browser
    browser = await chromium.connectOverCDP('http://localhost:9223');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      throw new Error('No contexts found. Make sure Edge is running with --remote-debugging-port=9223');
    }
    
    const context = contexts[0];
    const pages = context.pages();
    
    if (pages.length === 0) {
      throw new Error('No pages found');
    }
    
    // Find the WordleBot page or use the first page
    let page = pages[0];
    
    for (const p of pages) {
      const url = p.url();
      if (url.includes('wordle-bot')) {
        page = p;
        console.log('✅ Found WordleBot page:', url);
        break;
      }
    }
    
    if (!page.url().includes('wordle-bot')) {
      console.log('🔄 Current page is not WordleBot, navigating...');
      await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
      await page.waitForLoadState('networkidle');
    }
    
    console.log('📍 Page URL:', page.url());
    console.log('📄 Page title:', await page.title());
    
    // Debug the current page state
    const debugInfo = await page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent.slice(0, 300),
        hasContainer: !!document.querySelector('#g-wordle-results'),
        
        // Test all our selectors
        selectors: {},
        
        // Look for extension content script
        extensionPresent: !!window.__wordleBotScraper,
        
        // Check for any errors
        errors: [],
        
        // Page structure
        structure: {
          totalElements: document.querySelectorAll('*').length,
          divs: document.querySelectorAll('div').length,
          classes: []
        }
      };
      
      // Test our known selectors
      const selectorsToTest = [
        '.rating-container.svelte-pnoxcy',
        '.rating-container',
        '.show-more-button.svelte-151vgtd',
        '.show-more-button',
        '#g-wordle-results'
      ];
      
      for (const selector of selectorsToTest) {
        try {
          const elements = document.querySelectorAll(selector);
          info.selectors[selector] = {
            count: elements.length,
            hasContent: elements.length > 0 ? !!elements[0].textContent : false,
            sampleText: elements.length > 0 ? elements[0].textContent.slice(0, 100) : null
          };
        } catch (e) {
          info.selectors[selector] = { error: e.message };
        }
      }
      
      // Get unique classes on the page
      const allElements = document.querySelectorAll('*');
      const classSet = new Set();
      
      Array.from(allElements).forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => {
            if (cls.trim() && cls.includes('svelte')) {
              classSet.add(cls.trim());
            }
          });
        }
      });
      
      info.structure.classes = Array.from(classSet).slice(0, 20);
      
      return info;
    });
    
    console.log('\\n🔍 DEBUG INFORMATION:');
    console.log('======================');
    console.log('URL:', debugInfo.url);
    console.log('Title:', debugInfo.title);
    console.log('Has main container:', debugInfo.hasContainer);
    console.log('Extension present:', debugInfo.extensionPresent);
    console.log('Body text preview:', debugInfo.bodyText);
    
    console.log('\\n📊 SELECTOR RESULTS:');
    Object.entries(debugInfo.selectors).forEach(([selector, result]) => {
      if (result.error) {
        console.log(\`❌ \${selector}: ERROR - \${result.error}\`);
      } else {
        console.log(\`\${result.count > 0 ? '✅' : '❌'} \${selector}: \${result.count} elements\`);
        if (result.count > 0 && result.sampleText) {
          console.log(\`   Sample: \${result.sampleText}...\`);
        }
      }
    });
    
    console.log('\\n🏗️ PAGE STRUCTURE:');
    console.log('Total elements:', debugInfo.structure.totalElements);
    console.log('Divs:', debugInfo.structure.divs);
    console.log('Svelte classes found:', debugInfo.structure.classes.slice(0, 10));
    
    // If we found the container but no game cards, let's dig deeper
    if (debugInfo.hasContainer && debugInfo.selectors['.rating-container.svelte-pnoxcy'].count === 0) {
      console.log('\\n🕵️ DEEP DIVE - Container exists but no game cards found...');
      
      const deepAnalysis = await page.evaluate(() => {
        const container = document.querySelector('#g-wordle-results');
        if (!container) return null;
        
        const analysis = {
          containerText: container.textContent.slice(0, 500),
          directChildren: container.children.length,
          childrenInfo: [],
          allRatingContainers: [],
          anySvelteElements: []
        };
        
        // Analyze direct children
        Array.from(container.children).slice(0, 10).forEach((child, idx) => {
          analysis.childrenInfo.push({
            index: idx,
            tagName: child.tagName,
            className: child.className,
            textPreview: child.textContent.slice(0, 100)
          });
        });
        
        // Find all rating containers regardless of Svelte class
        const ratingContainers = container.querySelectorAll('[class*="rating"]');
        Array.from(ratingContainers).slice(0, 5).forEach(el => {
          analysis.allRatingContainers.push({
            className: el.className,
            textPreview: el.textContent.slice(0, 100),
            hasGameData: el.textContent.toLowerCase().includes('skill') && 
                        el.textContent.toLowerCase().includes('luck')
          });
        });
        
        // Find any Svelte elements
        const svelteElements = container.querySelectorAll('[class*="svelte"]');
        Array.from(svelteElements).slice(0, 5).forEach(el => {
          analysis.anySvelteElements.push({
            className: el.className,
            textPreview: el.textContent.slice(0, 100)
          });
        });
        
        return analysis;
      });
      
      if (deepAnalysis) {
        console.log('Container text preview:', deepAnalysis.containerText);
        console.log('Direct children:', deepAnalysis.directChildren);
        
        console.log('\\nFirst few children:');
        deepAnalysis.childrenInfo.forEach(child => {
          console.log(\`  \${child.index}: <\${child.tagName}> class="\${child.className}" - \${child.textPreview}...\`);
        });
        
        console.log('\\nRating containers found:');
        deepAnalysis.allRatingContainers.forEach((container, idx) => {
          console.log(\`  \${idx}: \${container.className} (hasGameData: \${container.hasGameData})\`);
          console.log(\`      Text: \${container.textPreview}...\`);
        });
        
        console.log('\\nSvelte elements found:');
        deepAnalysis.anySvelteElements.forEach((el, idx) => {
          console.log(\`  \${idx}: \${el.className}\`);
          console.log(\`      Text: \${el.textPreview}...\`);
        });
      }
    }
    
    // Test if we can manually extract any game data
    console.log('\\n🎮 MANUAL GAME EXTRACTION TEST:');
    
    const extractionTest = await page.evaluate(() => {
      // Look for ANY elements that might contain game data
      const allElements = document.querySelectorAll('*');
      const gamesFound = [];
      
      Array.from(allElements).forEach(el => {
        const text = el.textContent || '';
        
        // Look for elements with solution words (5 capital letters)
        const solutionMatch = text.match(/\\b([A-Z]{5})\\b/);
        const hasSkillLuck = text.toLowerCase().includes('skill') && text.toLowerCase().includes('luck');
        const hasSolution = text.toLowerCase().includes('solution');
        
        if ((solutionMatch || hasSolution) && text.length > 50 && text.length < 1000) {
          gamesFound.push({
            element: el.tagName + '.' + el.className,
            solution: solutionMatch ? solutionMatch[1] : 'not found',
            hasSkillLuck,
            hasSolution,
            textPreview: text.slice(0, 200)
          });
        }
      });
      
      return gamesFound.slice(0, 5); // Limit to first 5 matches
    });
    
    if (extractionTest.length > 0) {
      console.log('Found potential game elements:');
      extractionTest.forEach((game, idx) => {
        console.log(\`\\n  Game \${idx + 1}:\`);
        console.log(\`    Element: \${game.element}\`);
        console.log(\`    Solution: \${game.solution}\`);
        console.log(\`    Has skill/luck: \${game.hasSkillLuck}\`);
        console.log(\`    Has solution text: \${game.hasSolution}\`);
        console.log(\`    Text: \${game.textPreview}...\`);
      });
    } else {
      console.log('❌ No game data found anywhere on the page');
      
      // Final check - are we actually logged in?
      const loginCheck = await page.evaluate(() => {
        const paywall = document.querySelector('[class*="paywall"], [data-testid*="paywall"]');
        const loginButton = document.querySelector('[href*="login"], [data-testid*="log"]');
        const subscribeText = document.body.textContent.toLowerCase().includes('subscribe');
        
        return {
          hasPaywall: !!paywall,
          hasLoginButton: !!loginButton,
          hasSubscribeText: subscribeText,
          bodyTextSample: document.body.textContent.slice(0, 500)
        };
      });
      
      console.log('\\n🔐 LOGIN STATUS CHECK:');
      console.log('Has paywall:', loginCheck.hasPaywall);
      console.log('Has login button:', loginCheck.hasLoginButton);
      console.log('Has subscribe text:', loginCheck.hasSubscribeText);
      console.log('Page text sample:', loginCheck.bodyTextSample);
    }
    
    console.log('\\n👀 Browser window left open for manual inspection.');
    console.log('Check the page and press Ctrl+C when done.');
    
    // Keep open for inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\\n💡 To fix this:');
      console.log('1. Close Edge completely');
      console.log('2. Run: "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe" --remote-debugging-port=9223 --user-data-dir="C:\\\\temp\\\\edge-debug-new"');
      console.log('3. Navigate to WordleBot page');
      console.log('4. Run this test again');
    }
  }
}

debugLiveBrowser().catch(console.error);