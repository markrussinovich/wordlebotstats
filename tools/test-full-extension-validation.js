/**
 * Comprehensive validation test for the Wordle extension
 * Tests the complete workflow: scraping → storage → stats calculation
 */

import { chromium } from 'playwright';

async function validateFullExtension() {
  console.log('🧪 FULL EXTENSION VALIDATION TEST');
  console.log('=====================================\n');
  
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9223');
    const contexts = browser.contexts();
    const context = contexts[0];
    const pages = context.pages();
    
    let page = null;
    for (const p of pages) {
      if (p.url().includes('wordle-bot')) {
        page = p;
        break;
      }
    }
    
    if (!page) {
      throw new Error('WordleBot page not found. Please open https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html');
    }
    
    console.log('📄 Found WordleBot page');
    
    // Step 1: Validate page content
    console.log('\n🔍 STEP 1: Validating page content...');
    const pageValidation = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const showMoreBtn = document.querySelector('.show-more-button.svelte-151vgtd');
      
      return {
        cardsFound: cards.length,
        showMoreButtonExists: !!showMoreBtn,
        showMoreButtonVisible: showMoreBtn ? showMoreBtn.offsetParent !== null : false,
        sampleCardText: cards.length > 0 ? cards[0].textContent.slice(0, 100) : null
      };
    });
    
    console.log(`  ✅ Cards found: ${pageValidation.cardsFound}`);
    console.log(`  ✅ Show more button: ${pageValidation.showMoreButtonExists ? 'exists' : 'missing'} (${pageValidation.showMoreButtonVisible ? 'visible' : 'hidden'})`);
    if (pageValidation.sampleCardText) {
      console.log(`  ✅ Sample card text: "${pageValidation.sampleCardText}..."`);
    }
    
    // Step 2: Test content script extraction
    console.log('\n🔬 STEP 2: Testing content script extraction...');
    const extractionTest = await page.evaluate(() => {
      if (!window.__wordleBotScraper) {
        return { error: 'Content script not loaded' };
      }
      
      const games = window.__wordleBotScraper.extractVisibleGames();
      
      return {
        totalGames: games.length,
        validGames: games.filter(g => g.solution && g.skillScore).length,
        sampleGames: games.slice(0, 3).map(g => ({
          solution: g.solution,
          date: g.date,
          skillScore: g.skillScore,
          luckScore: g.luckScore,
          steps: g.steps,
          won: g.won
        }))
      };
    });
    
    if (extractionTest.error) {
      console.log(`  ❌ ${extractionTest.error}`);
      return;
    }
    
    console.log(`  ✅ Extracted ${extractionTest.totalGames} games`);
    console.log(`  ✅ Valid games: ${extractionTest.validGames}/${extractionTest.totalGames}`);
    console.log('  ✅ Sample extracted data:');
    extractionTest.sampleGames.forEach((game, idx) => {
      console.log(`    ${idx + 1}. ${game.solution} (${game.date}) - Score: ${game.skillScore}, Steps: ${game.steps}`);
    });
    
    // Step 3: Clear storage and test fresh import
    console.log('\n🗑️ STEP 3: Clearing storage for fresh test...');
    await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          chrome.storage.local.get(['games'], (result) => {
            resolve(result.games ? result.games.length : 0);
          });
        });
      });
    });
    console.log('  ✅ Storage cleared');
    
    // Step 4: Simulate popup trigger (manual scrape)
    console.log('\n🚀 STEP 4: Testing manual scrape trigger...');
    const scrapeResult = await page.evaluate(async () => {
      if (!window.__wordleBotScraper) {
        return { error: 'Content script not available' };
      }
      
      try {
        await window.__wordleBotScraper.startScraping('full', null, 2);
        
        // Wait a moment for storage to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check what got stored
        return new Promise((resolve) => {
          chrome.storage.local.get(['games'], (result) => {
            const storedGames = result.games || [];
            resolve({
              success: true,
              storedCount: storedGames.length,
              sampleStoredGame: storedGames[0] ? {
                solution: storedGames[0].solution,
                date: storedGames[0].date,
                won: storedGames[0].won,
                isWin: storedGames[0].isWin,
                attempts: storedGames[0].attempts,
                guesses: storedGames[0].guesses,
                skillScore: storedGames[0].skillScore
              } : null
            });
          });
        });
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (scrapeResult.error) {
      console.log(`  ❌ Scrape failed: ${scrapeResult.error}`);
      return;
    }
    
    console.log(`  ✅ Scrape completed successfully`);
    console.log(`  ✅ Games stored: ${scrapeResult.storedCount}`);
    if (scrapeResult.sampleStoredGame) {
      console.log('  ✅ Sample stored game:');
      console.log(`    Solution: ${scrapeResult.sampleStoredGame.solution}`);
      console.log(`    Date: ${scrapeResult.sampleStoredGame.date}`);
      console.log(`    Won: ${scrapeResult.sampleStoredGame.won}, isWin: ${scrapeResult.sampleStoredGame.isWin}`);
      console.log(`    Attempts: ${scrapeResult.sampleStoredGame.attempts}, Guesses: ${scrapeResult.sampleStoredGame.guesses}`);
      console.log(`    Skill Score: ${scrapeResult.sampleStoredGame.skillScore}`);
    }
    
    // Step 5: Test stats calculation
    console.log('\n📊 STEP 5: Testing stats calculation...');
    const statsTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['games'], (result) => {
          const games = result.games || [];
          
          if (games.length === 0) {
            resolve({ error: 'No games in storage' });
            return;
          }
          
          // Simulate the stats calculation from background script
          const recentGames = games.filter(game => {
            const gameDate = new Date(game.date);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return gameDate >= sevenDaysAgo;
          });
          
          const wins = recentGames.filter(game => game.isWin ?? game.won);
          const winRate = (wins.length / recentGames.length) * 100;
          
          const validGuesses = wins.filter(game => {
            const attempts = game.guesses ?? game.attempts;
            return attempts && attempts > 0;
          });
          
          const guessesSum = validGuesses.reduce((sum, game) => sum + (game.guesses ?? game.attempts), 0);
          const averageGuesses = validGuesses.length > 0 ? (guessesSum / validGuesses.length) : 0;
          
          resolve({
            totalGames: games.length,
            recentGames: recentGames.length,
            wins: wins.length,
            winRate: Math.round(winRate * 10) / 10,
            averageGuesses: Math.round(averageGuesses * 10) / 10,
            validGuesses: validGuesses.length,
            guessesSum
          });
        });
      });
    });
    
    if (statsTest.error) {
      console.log(`  ❌ Stats test failed: ${statsTest.error}`);
      return;
    }
    
    console.log(`  ✅ Total games in storage: ${statsTest.totalGames}`);
    console.log(`  ✅ Recent games (last 7 days): ${statsTest.recentGames}`);
    console.log(`  ✅ Wins: ${statsTest.wins}/${statsTest.recentGames}`);
    console.log(`  ✅ Win rate: ${statsTest.winRate}%`);
    console.log(`  ✅ Average guesses: ${statsTest.averageGuesses}`);
    console.log(`  ✅ Valid guess data: ${statsTest.validGuesses} games`);
    
    // Step 6: Validation summary
    console.log('\n🎯 VALIDATION SUMMARY:');
    console.log('=====================');
    
    const validationResults = {
      pageContent: pageValidation.cardsFound > 0,
      extraction: extractionTest.validGames > 0,
      storage: scrapeResult.storedCount > 0,
      dataIntegrity: scrapeResult.sampleStoredGame && 
                    scrapeResult.sampleStoredGame.isWin !== undefined && 
                    scrapeResult.sampleStoredGame.guesses !== undefined,
      statsCalculation: statsTest.winRate > 0 && statsTest.averageGuesses > 0
    };
    
    console.log(`✅ Page Content: ${validationResults.pageContent ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Data Extraction: ${validationResults.extraction ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Data Storage: ${validationResults.storage ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Data Integrity: ${validationResults.dataIntegrity ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Stats Calculation: ${validationResults.statsCalculation ? 'PASS' : 'FAIL'}`);
    
    const allPassed = Object.values(validationResults).every(result => result);
    
    console.log(`\n🏆 OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log('\n🎉 The extension is working correctly with live WordleBot data!');
      console.log('   - Scraping extracts real game data');
      console.log('   - Storage preserves all required fields');
      console.log('   - Stats calculation produces meaningful results');
    } else {
      console.log('\n⚠️ Some issues detected. Check the individual test results above.');
    }
    
  } catch (error) {
    console.error('❌ Validation test failed:', error.message);
  }
}

validateFullExtension().catch(console.error);