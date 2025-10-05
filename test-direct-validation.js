/**
 * Direct validation test - injects extraction logic and tests on live data
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function directValidationTest() {
  console.log('🧪 DIRECT VALIDATION TEST');
  console.log('=========================\n');
  
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
      throw new Error('WordleBot page not found');
    }
    
    console.log('📄 Found WordleBot page\n');
    
    // Step 1: Test direct extraction
    console.log('🔬 STEP 1: Testing direct game extraction...');
    const extractionResult = await page.evaluate(() => {
      // Inline extraction logic (copied from content script)
      function extractGameFromCard(card) {
        const game = {};
        const fullText = card.textContent || '';
        
        // Extract solution word
        const solutionMatch = fullText.match(/solution was:\s*([a-z]{5})/i);
        if (solutionMatch && solutionMatch[1]) {
          game.solution = solutionMatch[1].toUpperCase();
        }
        
        // Extract date
        const dateMatch = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
        if (dateMatch && dateMatch[1] && dateMatch[2]) {
          game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
          
          const month = dateMatch[1];
          const day = parseInt(dateMatch[2], 10);
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          
          let testDate = new Date(`${month} ${day}, ${currentYear}`);
          if (testDate > currentDate) {
            testDate = new Date(`${month} ${day}, ${currentYear - 1}`);
          }
          
          const isoDate = testDate.toISOString().split('T')[0];
          if (isoDate) {
            game.date = isoDate;
          }
        }
        
        // Extract skill score
        const skillMatch = fullText.match(/Your score was: (\d{1,3})/i);
        if (skillMatch && skillMatch[1]) {
          game.skillScore = parseInt(skillMatch[1], 10);
        }
        
        // Extract luck score
        const luckMatch = fullText.match(/Your luck was: (\d{1,3})/i);
        if (luckMatch && luckMatch[1]) {
          game.luckScore = parseInt(luckMatch[1], 10);
        }
        
        // Extract steps
        const stepsMatch = fullText.match(/It took you: (\d+)guesses/i);
        if (stepsMatch && stepsMatch[1]) {
          game.steps = parseInt(stepsMatch[1], 10);
          game.won = true;
        }
        
        return game;
      }
      
      // Convert to expected storage format
      function convertToGameResult(raw) {
        const now = new Date();
        const dateString = raw.date ?? now.toISOString().split('T')[0];
        
        return {
          date: dateString,
          won: raw.won ?? true,
          isWin: raw.won ?? true,  // For stats calculation
          attempts: raw.steps ?? null,
          guesses: raw.steps ?? null,  // For stats calculation
          hardMode: false,
          solution: raw.solution,
          skillScore: raw.skillScore,
          luckScore: raw.luckScore,
          scrapedFrom: 'wordle-bot',
          source: 'validation-test',
          importedAt: now.toISOString(),
          wordLength: 5,
          maxGuesses: 6
        };
      }
      
      // Extract all games
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const rawGames = [];
      
      cards.forEach((card, idx) => {
        const game = extractGameFromCard(card);
        if (game.solution || game.skillScore) {
          rawGames.push(game);
        }
      });
      
      // Convert to storage format
      const convertedGames = rawGames.map(raw => convertToGameResult(raw));
      
      // Calculate stats like the background script would
      const recentGames = convertedGames.filter(game => {
        const gameDate = new Date(game.date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return gameDate >= sevenDaysAgo;
      });
      
      const wins = recentGames.filter(game => game.isWin ?? game.won);
      const winRate = recentGames.length > 0 ? (wins.length / recentGames.length) * 100 : 0;
      
      const validGuesses = wins.filter(game => {
        const attempts = game.guesses ?? game.attempts;
        return attempts && attempts > 0;
      });
      
      const guessesSum = validGuesses.reduce((sum, game) => sum + (game.guesses ?? game.attempts), 0);
      const averageGuesses = validGuesses.length > 0 ? (guessesSum / validGuesses.length) : 0;
      
      return {
        totalCards: cards.length,
        rawGames: rawGames.length,
        convertedGames: convertedGames.length,
        sampleRaw: rawGames[0],
        sampleConverted: convertedGames[0],
        recentGames: recentGames.length,
        wins: wins.length,
        winRate: Math.round(winRate * 10) / 10,
        averageGuesses: Math.round(averageGuesses * 10) / 10,
        validGuesses: validGuesses.length
      };
    });
    
    console.log(`  ✅ Total cards found: ${extractionResult.totalCards}`);
    console.log(`  ✅ Raw games extracted: ${extractionResult.rawGames}`);
    console.log(`  ✅ Converted games: ${extractionResult.convertedGames}`);
    
    if (extractionResult.sampleRaw) {
      console.log('\n📊 Sample raw extraction:');
      console.log(`  Solution: ${extractionResult.sampleRaw.solution}`);
      console.log(`  Date: ${extractionResult.sampleRaw.dateString} -> ${extractionResult.sampleRaw.date}`);
      console.log(`  Skill: ${extractionResult.sampleRaw.skillScore}, Luck: ${extractionResult.sampleRaw.luckScore}`);
      console.log(`  Steps: ${extractionResult.sampleRaw.steps}, Won: ${extractionResult.sampleRaw.won}`);
    }
    
    if (extractionResult.sampleConverted) {
      console.log('\n🔄 Sample converted for storage:');
      console.log(`  Solution: ${extractionResult.sampleConverted.solution}`);
      console.log(`  Date: ${extractionResult.sampleConverted.date}`);
      console.log(`  Won: ${extractionResult.sampleConverted.won}, isWin: ${extractionResult.sampleConverted.isWin}`);
      console.log(`  Attempts: ${extractionResult.sampleConverted.attempts}, Guesses: ${extractionResult.sampleConverted.guesses}`);
      console.log(`  Skill Score: ${extractionResult.sampleConverted.skillScore}`);
    }
    
    console.log('\n📈 Stats calculation test:');
    console.log(`  Recent games (7 days): ${extractionResult.recentGames}`);
    console.log(`  Wins: ${extractionResult.wins}/${extractionResult.recentGames}`);
    console.log(`  Win rate: ${extractionResult.winRate}%`);
    console.log(`  Average guesses: ${extractionResult.averageGuesses}`);
    console.log(`  Games with valid guess data: ${extractionResult.validGuesses}`);
    
    // Validation
    console.log('\n🎯 VALIDATION RESULTS:');
    console.log('=====================');
    
    const results = {
      extraction: extractionResult.rawGames > 0,
      conversion: extractionResult.convertedGames === extractionResult.rawGames,
      dataIntegrity: extractionResult.sampleConverted && 
                    extractionResult.sampleConverted.isWin !== undefined &&
                    extractionResult.sampleConverted.guesses !== undefined,
      statsCalculation: extractionResult.winRate > 0 && extractionResult.averageGuesses > 0,
      recentData: extractionResult.recentGames > 0
    };
    
    console.log(`✅ Data Extraction: ${results.extraction ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Data Conversion: ${results.conversion ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Data Integrity: ${results.dataIntegrity ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Stats Calculation: ${results.statsCalculation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Recent Data Available: ${results.recentData ? 'PASS' : 'FAIL'}`);
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\n🏆 OVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log('\n🎉 SUCCESS! The extraction and stats logic works perfectly with live data!');
      console.log(`   Expected popup stats: ${extractionResult.recentGames} games, ${extractionResult.winRate}% win rate, ${extractionResult.averageGuesses} avg guesses`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

directValidationTest().catch(console.error);