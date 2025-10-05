/**
 * Test with corrected regex patterns
 */

import { chromium } from 'playwright';

async function testFixedPatterns() {
  console.log('🧪 Testing with corrected patterns...\n');
  
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
    
    const testResults = await page.evaluate(() => {
      function extractGameFromCard(card) {
        const game = {};
        const fullText = card.textContent || '';
        
        console.log('Raw card text:', fullText);
        
        // FIXED: Extract solution - "solution was: relay"
        const solutionMatch = fullText.match(/solution was:\\s*([a-z]{5})/i);
        if (solutionMatch && solutionMatch[1]) {
          game.solution = solutionMatch[1].toUpperCase();
        }
        
        // FIXED: Extract date - "October 4"
        const dateMatch = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{1,2})/);
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
          
          game.date = testDate.toISOString().split('T')[0];
        }
        
        // FIXED: Extract skill score - "Your score was: 99"
        const skillMatch = fullText.match(/Your score was:\\s*(\\d{1,3})/i);
        if (skillMatch && skillMatch[1]) {
          game.skillScore = parseInt(skillMatch[1], 10);
        }
        
        // FIXED: Extract luck score - "Your luck was: 76"
        const luckMatch = fullText.match(/Your luck was:\\s*(\\d{1,3})/i);
        if (luckMatch && luckMatch[1]) {
          game.luckScore = parseInt(luckMatch[1], 10);
        }
        
        // FIXED: Extract steps - "It took you: 3guesses"
        const stepsMatch = fullText.match(/It took you:\\s*(\\d+)/i);
        if (stepsMatch && stepsMatch[1]) {
          game.steps = parseInt(stepsMatch[1], 10);
          game.won = true;
        }
        
        return game;
      }
      
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const results = {
        totalCards: cards.length,
        extractedGames: []
      };
      
      Array.from(cards).slice(0, 3).forEach((card, idx) => {
        const game = extractGameFromCard(card);
        game.cardIndex = idx;
        results.extractedGames.push(game);
      });
      
      return results;
    });
    
    console.log('📊 FIXED PATTERN TEST RESULTS:');
    console.log('==============================');
    console.log(`Total cards: ${testResults.totalCards}`);
    console.log(`Games extracted: ${testResults.extractedGames.length}`);
    
    testResults.extractedGames.forEach((game, idx) => {
      console.log(`\nGame ${idx + 1}:`);
      console.log(`  Solution: ${game.solution || 'NOT FOUND'}`);
      console.log(`  Date: ${game.dateString || 'NOT FOUND'} (${game.date || 'NO ISO DATE'})`);
      console.log(`  Skill Score: ${game.skillScore || 'NOT FOUND'}`);
      console.log(`  Luck Score: ${game.luckScore || 'NOT FOUND'}`);
      console.log(`  Steps: ${game.steps !== undefined ? game.steps : 'NOT FOUND'}`);
      console.log(`  Won: ${game.won !== undefined ? game.won : 'NOT FOUND'}`);
    });
    
    const successfulExtractions = testResults.extractedGames.filter(g => 
      g.solution && g.skillScore !== undefined
    ).length;
    
    console.log(`\n🎯 RESULT: ${successfulExtractions}/${testResults.extractedGames.length} games fully extracted`);
    
    if (successfulExtractions > 0) {
      console.log('✅ PATTERNS WORK! Now need to fix extension loading.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFixedPatterns().catch(console.error);