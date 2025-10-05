/**
 * Manual WordleBot test - injects scraper code into your existing browser session
 */

import fs from 'fs';
import path from 'path';

function generateScraperTest() {
  return `
// WordleBot Scraper Test - Run this in browser console
// Copy and paste this entire script into the browser console on the WordleBot page

(async function runWordleBotTest() {
  console.log('🚀 Starting WordleBot Scraper Test');
  console.log('===================================\\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    tests: [],
    debug: {}
  };
  
  // Helper function to add test results
  function addTest(name, passed, details) {
    const status = passed ? '✅' : '❌';
    console.log(\`\${status} \${name}: \${details}\`);
    results.tests.push({ test: name, passed, details });
  }
  
  // Test 1: Page verification
  console.log('📍 Page Verification');
  const isWordleBotPage = window.location.href.includes('wordle-bot');
  addTest('WordleBot page detected', isWordleBotPage, isWordleBotPage ? 'Correct page' : 'Wrong page');
  
  if (!isWordleBotPage) {
    console.error('❌ Please navigate to: https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
    return results;
  }
  
  // Test 2: Authentication check
  console.log('\\n🔐 Authentication Check');
  const hasGameContent = document.querySelector('#g-wordle-results') || document.querySelector('[class*="wordle"], [class*="game"], [class*="result"]');
  const hasPaywall = document.querySelector('[class*="paywall"], [data-testid*="paywall"]') || 
                     document.body.textContent.toLowerCase().includes('subscribe');
  
  addTest('User authenticated', hasGameContent && !hasPaywall, 
    hasGameContent ? 'Game content visible' : 'No game content - login required');
  
  if (!hasGameContent) {
    console.log('⚠️  Please log in to see your game history, then run this test again.');
    return results;
  }
  
  // Test 3: Container detection
  console.log('\\n📦 Container Detection');
  const mainContainer = document.querySelector('#g-wordle-results');
  addTest('Main container found', !!mainContainer, mainContainer ? 'Found #g-wordle-results' : 'Container missing');
  
  // Test 4: Game card detection with multiple strategies
  console.log('\\n🎮 Game Card Detection');
  
  const strategies = [
    { name: 'v5 selector (.rating-container.svelte-pnoxcy)', selector: '.rating-container.svelte-pnoxcy' },
    { name: 'Generic rating containers', selector: '.rating-container' },
    { name: 'Any rating elements', selector: '[class*="rating"]' },
    { name: 'Svelte components', selector: '[class*="svelte"]' },
    { name: 'Card-like elements', selector: '[class*="card"]' }
  ];
  
  let bestStrategy = null;
  let gameCards = [];
  
  for (const strategy of strategies) {
    try {
      const elements = document.querySelectorAll(strategy.selector);
      
      // Filter for elements that look like game cards
      const filtered = Array.from(elements).filter(el => {
        const text = el.textContent.toLowerCase();
        const hasGameData = text.includes('skill') || text.includes('luck') || 
                           text.includes('solution') || /\\b[a-z]{5}\\b/i.test(text);
        const isNotLabel = !el.classList.contains('label-container') && 
                          !text.includes('skill score') && !text.includes('luck score');
        return hasGameData && isNotLabel;
      });
      
      if (filtered.length > gameCards.length) {
        bestStrategy = strategy;
        gameCards = filtered;
      }
      
      addTest(strategy.name, filtered.length > 0, \`Found \${filtered.length} game cards\`);
    } catch (e) {
      addTest(strategy.name, false, \`Error: \${e.message}\`);
    }
  }
  
  if (gameCards.length === 0) {
    console.log('\\n🔍 Debugging - Looking for ANY elements with game-like content...');
    const allElements = document.querySelectorAll('*');
    let foundSomething = false;
    
    Array.from(allElements).forEach(el => {
      const text = el.textContent;
      if (text.length > 20 && text.length < 500) {
        if (text.toLowerCase().includes('skill') && text.toLowerCase().includes('luck')) {
          console.log('Found potential game element:', el.className, text.slice(0, 100));
          foundSomething = true;
        }
      }
    });
    
    if (!foundSomething) {
      console.log('No game-like content found anywhere on the page');
    }
  }
  
  console.log(\`\\n🏆 Best strategy: \${bestStrategy?.name} with \${gameCards.length} cards\`);
  
  // Test 5: Pagination button detection
  console.log('\\n⏭️ Pagination Detection');
  
  const buttonStrategies = [
    { name: 'v5 selector (.show-more-button.svelte-151vgtd)', selector: '.show-more-button.svelte-151vgtd' },
    { name: 'Generic show-more', selector: '.show-more-button' },
    { name: 'Show more class', selector: '[class*="show-more"]' },
    { name: 'Load more class', selector: '[class*="load-more"]' }
  ];
  
  let showMoreBtn = null;
  let buttonStrategy = null;
  
  for (const strategy of buttonStrategies) {
    const btn = document.querySelector(strategy.selector);
    if (btn) {
      showMoreBtn = btn;
      buttonStrategy = strategy;
      addTest(strategy.name, true, \`Found: "\${btn.textContent.trim()}"\`);
      break;
    } else {
      addTest(strategy.name, false, 'Not found');
    }
  }
  
  // Also search by text content
  if (!showMoreBtn) {
    console.log('\\nSearching for buttons by text content...');
    const allButtons = document.querySelectorAll('button, [role="button"], div[onclick], [class*="button"]');
    
    for (const btn of allButtons) {
      const text = btn.textContent.toLowerCase().trim();
      if ((text.includes('more') && text.includes('wordle')) || 
          (text.includes('show') && text.includes('more')) ||
          text.includes('load more')) {
        showMoreBtn = btn;
        addTest('Text-based button search', true, \`Found: "\${btn.textContent.trim()}"\`);
        break;
      }
    }
    
    if (!showMoreBtn) {
      addTest('Text-based button search', false, 'No pagination button found');
    }
  }
  
  // Test 6: Data extraction
  if (gameCards.length > 0) {
    console.log('\\n📊 Data Extraction Test');
    
    const sampleGames = [];
    const extractionPatterns = {
      solution: [
        /solution was:\\s*([a-z]{5})/i,
        /solution:\\s*([a-z]{5})/i,
        /answer was:\\s*([a-z]{5})/i,
        /word was:\\s*([a-z]{5})/i,
        /\\b([A-Z]{5})\\b/
      ],
      date: [
        /(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})/
      ],
      skill: [
        /(?:Your score was|score was|skill score)[:\\s]+(\\d{1,3})/i,
        /skill[:\\s]+(\\d{1,3})/i
      ],
      luck: [
        /(?:Your luck was|luck was|luck score)[:\\s]+(\\d{1,3})/i,
        /luck[:\\s]+(\\d{1,3})/i
      ],
      steps: [
        /(?:It took you|took you)[:\\s]+(\\d+|X)/i,
        /steps?[:\\s]+(\\d+|X)/i,
        /(\\d+)\\s*guess/i
      ]
    };
    
    for (let i = 0; i < Math.min(3, gameCards.length); i++) {
      const card = gameCards[i];
      const text = card.textContent;
      const game = {
        index: i,
        extracted: {},
        patterns: {},
        rawText: text.slice(0, 200)
      };
      
      // Try extraction patterns
      for (const [field, patterns] of Object.entries(extractionPatterns)) {
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            switch (field) {
              case 'solution':
                game.extracted.solution = match[1].toUpperCase();
                break;
              case 'date':
                game.extracted.dateString = \`\${match[1]} \${match[2]}\`;
                break;
              case 'skill':
                game.extracted.skillScore = parseInt(match[1]);
                break;
              case 'luck':
                game.extracted.luckScore = parseInt(match[1]);
                break;
              case 'steps':
                const val = match[1];
                game.extracted.steps = val.toUpperCase() === 'X' ? 0 : parseInt(val);
                game.extracted.won = val.toUpperCase() !== 'X';
                break;
            }
            game.patterns[field] = pattern.toString();
            break;
          }
        }
      }
      
      sampleGames.push(game);
    }
    
    const successfulExtractions = sampleGames.filter(g => 
      Object.keys(g.extracted).length > 0
    ).length;
    
    addTest('Data extraction', successfulExtractions > 0, 
      \`Successfully extracted data from \${successfulExtractions}/\${sampleGames.length} cards\`);
    
    // Show sample results
    console.log('\\n📋 Sample Extraction Results:');
    sampleGames.forEach((game, idx) => {
      console.log(\`\\nGame \${idx + 1}:\`);
      console.log(\`  Solution: \${game.extracted.solution || 'Not found'}\`);
      console.log(\`  Date: \${game.extracted.dateString || 'Not found'}\`);
      console.log(\`  Skill: \${game.extracted.skillScore || 'Not found'}\`);
      console.log(\`  Luck: \${game.extracted.luckScore || 'Not found'}\`);
      console.log(\`  Steps: \${game.extracted.steps !== undefined ? game.extracted.steps : 'Not found'}\`);
      console.log(\`  Won: \${game.extracted.won !== undefined ? game.extracted.won : 'Not found'}\`);
      console.log(\`  Raw text: \${game.rawText}...\`);
    });
    
    results.sampleGames = sampleGames;
  }
  
  // Test 7: Pagination test (if button found)
  if (showMoreBtn && showMoreBtn.offsetParent !== null) {
    console.log('\\n🔄 Pagination Test');
    
    const beforeCount = gameCards.length;
    console.log(\`Before click: \${beforeCount} cards\`);
    
    try {
      showMoreBtn.click();
      console.log('Clicked pagination button, waiting 3 seconds...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Re-count cards using the same selector
      const newCards = document.querySelectorAll(bestStrategy.selector);
      const filteredNew = Array.from(newCards).filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('skill') || text.includes('luck') || text.includes('solution');
      });
      
      const afterCount = filteredNew.length;
      const newCardsLoaded = afterCount - beforeCount;
      
      console.log(\`After click: \${afterCount} cards (+\${newCardsLoaded})\`);
      
      addTest('Pagination functionality', newCardsLoaded > 0, 
        \`Loaded \${newCardsLoaded} new cards\`);
      
      results.paginationTest = {
        beforeCount,
        afterCount,
        newCardsLoaded,
        success: newCardsLoaded > 0
      };
      
    } catch (e) {
      addTest('Pagination functionality', false, \`Error: \${e.message}\`);
    }
  }
  
  // Final summary
  console.log('\\n🎯 FINAL RESULTS');
  console.log('================');
  
  const passedTests = results.tests.filter(t => t.passed).length;
  const totalTests = results.tests.length;
  
  console.log(\`Tests passed: \${passedTests}/\${totalTests}\`);
  console.log(\`Game cards found: \${gameCards.length}\`);
  console.log(\`Best selector: \${bestStrategy?.selector}\`);
  console.log(\`Pagination available: \${!!showMoreBtn}\`);
  console.log(\`Data extraction working: \${results.sampleGames ? results.sampleGames.some(g => Object.keys(g.extracted).length > 0) : false}\`);
  
  if (passedTests === totalTests) {
    console.log('\\n🎉 ALL TESTS PASSED! The scraper should work.');
  } else if (gameCards.length > 0 && results.sampleGames?.some(g => Object.keys(g.extracted).length > 0)) {
    console.log('\\n✅ CORE FUNCTIONALITY WORKING! Minor issues can be fixed.');
  } else {
    console.log('\\n⚠️  ISSUES DETECTED. Manual inspection needed.');
  }
  
  // Store results globally for inspection
  window.__WORDLE_TEST_RESULTS__ = results;
  console.log('\\n💾 Results stored in: window.__WORDLE_TEST_RESULTS__');
  
  return results;
})();
`;
}

async function createManualTest() {
  console.log('🔧 Creating manual WordleBot test script...\n');
  
  const testScript = generateScraperTest();
  
  // Save to file for easy copying
  const testFile = 'test-results/wordle-bot-manual-test.js';
  const resultsDir = 'test-results';
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  fs.writeFileSync(testFile, testScript);
  
  console.log('📋 MANUAL TEST INSTRUCTIONS:');
  console.log('============================');
  console.log('');
  console.log('1. Open your regular browser (Edge/Chrome)');
  console.log('2. Log in to NYTimes if not already logged in');
  console.log('3. Navigate to: https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
  console.log('4. Make sure you can see your Wordle game history');
  console.log('5. Open Developer Tools (F12)');
  console.log('6. Go to the Console tab');
  console.log('7. Copy and paste the script below, then press Enter');
  console.log('');
  console.log('📄 TEST SCRIPT:');
  console.log('===============');
  console.log('(Script saved to: ' + testFile + ')');
  console.log('');
  console.log(testScript);
  console.log('');
  console.log('⚠️  Alternative: If copy/paste fails, run this command to see the script:');
  console.log(`   type "${testFile}"`);
  console.log('');
  console.log('🎯 What this test will do:');
  console.log('- ✅ Verify you are on the right page');
  console.log('- ✅ Check if you are logged in');
  console.log('- ✅ Find game cards using our selectors');
  console.log('- ✅ Find the "Show more" pagination button');
  console.log('- ✅ Extract sample game data');
  console.log('- ✅ Test pagination functionality');
  console.log('- ✅ Show exactly what works and what doesn\'t');
  console.log('');
  console.log('📊 After running, look for:');
  console.log('- Green ✅ marks for working features');
  console.log('- Red ❌ marks for issues');
  console.log('- Sample extracted game data');
  console.log('- Final success/failure summary');
}

createManualTest().catch(console.error);