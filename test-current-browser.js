/**
 * Test the current browser instance directly
 */

import { chromium } from 'playwright';

async function testCurrentBrowser() {
  console.log('🔍 Testing current browser instance...\n');
  
  let browser;
  
  try {
    // Try to connect to your current browser session
    console.log('🔌 Attempting to connect to current browser...');
    
    // Check common debugging ports
    const ports = [9222, 9223, 9224];
    let connected = false;
    
    for (const port of ports) {
      try {
        console.log(`  Trying port ${port}...`);
        browser = await chromium.connectOverCDP(`http://localhost:${port}`);
        console.log(`✅ Connected on port ${port}`);
        connected = true;
        break;
      } catch (e) {
        console.log(`  Port ${port} not available`);
      }
    }
    
    if (!connected) {
      console.log('\n❌ Could not connect to browser.');
      console.log('\n📋 To enable remote debugging:');
      console.log('1. Close Edge completely');
      console.log('2. Run: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9222');
      console.log('3. Navigate to WordleBot page');
      console.log('4. Run this test again\n');
      return;
    }
    
    const contexts = browser.contexts();
    const context = contexts[0];
    const pages = context.pages();
    
    // Find WordleBot page
    let page = null;
    for (const p of pages) {
      const url = p.url();
      if (url.includes('wordle-bot')) {
        page = p;
        break;
      }
    }
    
    if (!page) {
      console.log('❌ WordleBot page not found. Please navigate to:');
      console.log('   https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
      return;
    }
    
    console.log('✅ Found WordleBot page:', page.url());
    
    // Run our test
    const results = await page.evaluate(() => {
      const test = {
        url: window.location.href,
        title: document.title,
        tests: []
      };
      
      // Test 1: Container
      const container = document.querySelector('#g-wordle-results');
      test.tests.push({
        name: 'Main container',
        passed: !!container,
        details: container ? 'Found' : 'Not found'
      });
      
      // Test 2: Game cards with original selector
      const gameCards1 = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      test.tests.push({
        name: 'Game cards (original selector)',
        passed: gameCards1.length > 0,
        details: `Found ${gameCards1.length} cards`
      });
      
      // Test 3: Game cards with generic selector
      const gameCards2 = document.querySelectorAll('.rating-container');
      test.tests.push({
        name: 'Game cards (generic selector)',
        passed: gameCards2.length > 0,
        details: `Found ${gameCards2.length} cards`
      });
      
      // Test 4: Show more button
      const showMore1 = document.querySelector('.show-more-button.svelte-151vgtd');
      test.tests.push({
        name: 'Show more button (original)',
        passed: !!showMore1,
        details: showMore1 ? `Found: "${showMore1.textContent.trim()}"` : 'Not found'
      });
      
      // Test 5: Show more button generic
      const showMore2 = document.querySelector('.show-more-button');
      test.tests.push({
        name: 'Show more button (generic)',
        passed: !!showMore2,
        details: showMore2 ? `Found: "${showMore2.textContent.trim()}"` : 'Not found'
      });
      
      // Test 6: Look for any elements with game data
      const allElements = document.querySelectorAll('*');
      let gameDataElements = 0;
      let sampleGameText = '';
      
      Array.from(allElements).forEach(el => {
        const text = el.textContent || '';
        if (text.includes('skill') && text.includes('luck') && text.length > 50 && text.length < 500) {
          gameDataElements++;
          if (!sampleGameText) {
            sampleGameText = text.slice(0, 150);
          }
        }
      });
      
      test.tests.push({
        name: 'Elements with game data',
        passed: gameDataElements > 0,
        details: `Found ${gameDataElements} elements with skill/luck data`
      });
      
      // Test 7: Extension detection
      const hasExtension = !!window.__wordleBotScraper;
      test.tests.push({
        name: 'Extension content script',
        passed: hasExtension,
        details: hasExtension ? 'Extension loaded' : 'Extension not detected'
      });
      
      // Sample data
      test.sampleGameText = sampleGameText;
      test.gameDataElements = gameDataElements;
      
      // Page info
      test.pageInfo = {
        totalElements: document.querySelectorAll('*').length,
        bodyTextPreview: document.body.textContent.slice(0, 200)
      };
      
      return test;
    });
    
    // Display results
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    console.log(`Page: ${results.title}`);
    console.log(`URL: ${results.url}\n`);
    
    results.tests.forEach((test, idx) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${test.name}: ${test.details}`);
    });
    
    console.log('\n📋 PAGE INFO:');
    console.log(`Total elements: ${results.pageInfo.totalElements}`);
    console.log(`Body text preview: ${results.pageInfo.bodyTextPreview}...`);
    
    if (results.sampleGameText) {
      console.log('\n🎮 SAMPLE GAME DATA FOUND:');
      console.log(results.sampleGameText);
    }
    
    // Try to find current Svelte classes
    console.log('\n🔍 FINDING CURRENT SVELTE CLASSES...');
    
    const svelteClasses = await page.evaluate(() => {
      const classes = new Set();
      const elements = document.querySelectorAll('[class*="svelte"]');
      
      Array.from(elements).forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => {
            if (cls.includes('svelte') && cls.includes('rating')) {
              classes.add(cls);
            }
          });
        }
      });
      
      return Array.from(classes);
    });
    
    console.log('Svelte rating classes found:', svelteClasses);
    
    // If we found different classes, test them
    if (svelteClasses.length > 0) {
      console.log('\n🧪 TESTING UPDATED SELECTORS...');
      
      for (const cls of svelteClasses) {
        const count = await page.evaluate((className) => {
          return document.querySelectorAll(`.${className}`).length;
        }, cls);
        
        console.log(`  .${cls}: ${count} elements`);
        
        if (count > 0) {
          // Test if these elements have game data
          const hasGameData = await page.evaluate((className) => {
            const elements = document.querySelectorAll(`.${className}`);
            let withGameData = 0;
            
            Array.from(elements).forEach(el => {
              const text = el.textContent || '';
              if (text.includes('skill') && text.includes('luck')) {
                withGameData++;
              }
            });
            
            return withGameData;
          }, cls);
          
          console.log(`    → ${hasGameData} with game data`);
        }
      }
    }
    
    const passedTests = results.tests.filter(t => t.passed).length;
    console.log(`\n🎯 SCORE: ${passedTests}/${results.tests.length} tests passed`);
    
    if (results.gameDataElements > 0) {
      console.log('✅ Game data is present on the page!');
    } else {
      console.log('❌ No game data found. Check if you\'re logged in and can see game history.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Don't close browser - user is using it
    console.log('\n✅ Test complete. Browser left open.');
  }
}

testCurrentBrowser().catch(console.error);