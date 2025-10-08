/**
 * Live test of WordleBot scraper using existing logged-in Edge browser
 * 
 * Usage:
 * 1. Open Edge browser and go to https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html
 * 2. Ensure you're logged in and can see your game history
 * 3. Run: node test-wordle-bot-live.js
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function testWordleBotScraper() {
  console.log('🚀 Starting WordleBot scraper live test...\n');
  
  let browser;
  let context;
  
  try {
    // Connect to existing Edge browser
    // First, get the CDP endpoint from running Edge with --remote-debugging-port=9222
    console.log('📋 SETUP INSTRUCTIONS:');
    console.log('1. Close all Edge windows');
    console.log('2. Open Command Prompt and run:');
    console.log('   "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9222 --user-data-dir="C:\\temp\\edge-debug"');
    console.log('3. Navigate to: https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
    console.log('4. Ensure you can see your game history');
    console.log('5. Run this script again\n');
    
    console.log('⏳ Attempting to connect to Edge on port 9222...');
    
    // Connect to Chrome DevTools endpoint
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      throw new Error('No browser contexts found. Make sure Edge is running with --remote-debugging-port=9222');
    }
    
    context = contexts[0];
    const pages = context.pages();
    
    if (pages.length === 0) {
      throw new Error('No pages found. Make sure you have a tab open in Edge.');
    }
    
    // Use the first page or find the WordleBot page
    let page = pages[0];
    
    // Check if any page is already on WordleBot
    for (const p of pages) {
      const url = p.url();
      if (url.includes('wordle-bot')) {
        page = p;
        console.log('✅ Found WordleBot page:', url);
        break;
      }
    }
    
    // If not on WordleBot page, navigate there
    if (!page.url().includes('wordle-bot')) {
      console.log('🔄 Navigating to WordleBot page...');
      await page.goto('https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
      await page.waitForLoadState('networkidle');
    }
    
    console.log('📍 Current page:', page.url());
    
    // Wait for the page to be ready
    console.log('⏳ Waiting for page to load...');
    await page.waitForSelector('#g-wordle-results', { timeout: 10000 });
    
    // Inject our scraper code
    console.log('💉 Injecting scraper code...');
    
    const scraperCode = `
      // WordleBot scraper based on confirmed v5 patterns
      (async function testScraper() {
        const results = {
          timestamp: new Date().toISOString(),
          url: window.location.href,
          tests: []
        };
        
        // Test 1: Find container
        const container = document.querySelector('#g-wordle-results');
        results.tests.push({
          test: 'Container found',
          passed: !!container,
          details: container ? 'Found #g-wordle-results' : 'Container not found'
        });
        
        if (!container) return results;
        
        // Test 2: Find game cards
        const gameCards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
        results.tests.push({
          test: 'Game cards found',
          passed: gameCards.length > 0,
          details: \`Found \${gameCards.length} game cards\`
        });
        
        // Test 3: Find show more button
        const showMoreBtn = document.querySelector('.show-more-button.svelte-151vgtd');
        results.tests.push({
          test: 'Show more button found',
          passed: !!showMoreBtn,
          details: showMoreBtn ? \`Button text: "\${showMoreBtn.textContent.trim()}"\` : 'Button not found'
        });
        
        // Test 4: Extract data from first game card
        if (gameCards.length > 0) {
          const firstCard = gameCards[0];
          const text = firstCard.textContent;
          
          const extractedData = {};
          
          // Extract solution
          const solutionMatch = text.match(/solution was:\\s*([a-z]{5})/i);
          if (solutionMatch) extractedData.solution = solutionMatch[1].toUpperCase();
          
          // Extract date
          const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})/);
          if (dateMatch) extractedData.dateString = \`\${dateMatch[1]} \${dateMatch[2]}\`;
          
          // Extract skill score
          const skillMatch = text.match(/(?:Your score was|score was)[:\\s]+(\\d{1,3})/i);
          if (skillMatch) extractedData.skillScore = parseInt(skillMatch[1]);
          
          // Extract luck score
          const luckMatch = text.match(/(?:Your luck was|luck was)[:\\s]+(\\d{1,3})/i);
          if (luckMatch) extractedData.luckScore = parseInt(luckMatch[1]);
          
          // Extract steps
          const stepsMatch = text.match(/(?:It took you|took you)[:\\s]+(\\d+|X)/i);
          if (stepsMatch) {
            const val = stepsMatch[1];
            extractedData.steps = val === 'X' ? 0 : parseInt(val);
            extractedData.won = val !== 'X';
          }
          
          results.tests.push({
            test: 'Data extraction from first card',
            passed: Object.keys(extractedData).length > 0,
            details: extractedData
          });
          
          results.sampleGame = extractedData;
        }
        
        // Test 5: Try to extract multiple games
        const allGames = [];
        gameCards.forEach((card, idx) => {
          if (idx >= 5) return; // Only test first 5
          
          const text = card.textContent;
          const game = { index: idx };
          
          const solutionMatch = text.match(/solution was:\\s*([a-z]{5})/i);
          if (solutionMatch) game.solution = solutionMatch[1].toUpperCase();
          
          const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})/);
          if (dateMatch) game.dateString = \`\${dateMatch[1]} \${dateMatch[2]}\`;
          
          const skillMatch = text.match(/(?:Your score was|score was)[:\\s]+(\\d{1,3})/i);
          if (skillMatch) game.skillScore = parseInt(skillMatch[1]);
          
          if (game.solution || game.skillScore) {
            allGames.push(game);
          }
        });
        
        results.tests.push({
          test: 'Multiple game extraction',
          passed: allGames.length > 0,
          details: \`Extracted \${allGames.length} games from first 5 cards\`
        });
        
        results.sampleGames = allGames;
        results.totalCardsFound = gameCards.length;
        results.hasShowMoreButton = !!showMoreBtn;
        results.showMoreButtonVisible = showMoreBtn ? (showMoreBtn.offsetParent !== null) : false;
        
        return results;
      })();
    `;
    
    // Execute the scraper test
    const testResults = await page.evaluate(scraperCode);
    
    // Display results
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    
    testResults.tests.forEach((test, idx) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${idx + 1}. ${status} ${test.test}`);
      console.log(`   ${test.details}`);
    });
    
    console.log('\n📈 SUMMARY:');
    console.log(`Total game cards found: ${testResults.totalCardsFound}`);
    console.log(`Show more button present: ${testResults.hasShowMoreButton ? 'Yes' : 'No'}`);
    console.log(`Show more button visible: ${testResults.showMoreButtonVisible ? 'Yes' : 'No'}`);
    
    if (testResults.sampleGame) {
      console.log('\n🎮 SAMPLE GAME DATA:');
      console.log(JSON.stringify(testResults.sampleGame, null, 2));
    }
    
    if (testResults.sampleGames && testResults.sampleGames.length > 0) {
      console.log('\n📝 SAMPLE GAMES (first 5):');
      testResults.sampleGames.forEach((game, idx) => {
        console.log(`  ${idx + 1}. ${game.solution || 'No solution'} (${game.dateString || 'No date'}) - Skill: ${game.skillScore || 'N/A'}`);
      });
    }
    
    // Save detailed results
    const resultsFile = 'test-results/wordle-bot-live-test.json';
    const resultsDir = 'test-results';
    
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
    
    // Test pagination if button is available
    if (testResults.hasShowMoreButton && testResults.showMoreButtonVisible) {
      console.log('\n🔄 Testing pagination...');
      
      const paginationTest = await page.evaluate(async () => {
        const btn = document.querySelector('.show-more-button.svelte-151vgtd');
        const beforeCount = document.querySelectorAll('.rating-container.svelte-pnoxcy').length;
        
        btn.click();
        
        // Wait for new content
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const afterCount = document.querySelectorAll('.rating-container.svelte-pnoxcy').length;
        const newCards = afterCount - beforeCount;
        
        return {
          beforeCount,
          afterCount,
          newCards,
          success: newCards > 0
        };
      });
      
      console.log(`  Before click: ${paginationTest.beforeCount} cards`);
      console.log(`  After click: ${paginationTest.afterCount} cards`);
      console.log(`  New cards loaded: ${paginationTest.newCards}`);
      console.log(`  Pagination working: ${paginationTest.success ? 'Yes' : 'No'}`);
      
      testResults.paginationTest = paginationTest;
    }
    
    const passedTests = testResults.tests.filter(t => t.passed).length;
    const totalTests = testResults.tests.length;
    
    console.log(`\n🎯 FINAL SCORE: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Scraper is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the details above.');
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('Make sure Edge is running with remote debugging enabled:');
      console.log('1. Close all Edge windows');
      console.log('2. Run: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --remote-debugging-port=9222');
      console.log('3. Navigate to WordleBot page');
      console.log('4. Run this test again');
    }
  } finally {
    // Don't close the browser - we're using the user's browser
    console.log('\n✅ Test complete. Browser left open.');
  }
}

// Run the test
testWordleBotScraper().catch(console.error);