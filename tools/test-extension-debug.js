/**
 * Test the extension extraction logic directly
 */

import { chromium } from 'playwright';

async function testExtraction() {
  console.log('🧪 Testing extraction logic...\n');
  
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
      // Test our exact extraction logic
      function extractGameFromCard(card) {
        const game = {};
        const fullText = card.textContent || '';
        
        console.log('Testing card with text:', fullText.slice(0, 200));
        
        // Extract solution word
        const solutionMatch = fullText.match(/solution was:\\s*([a-z]{5})/i);
        if (solutionMatch && solutionMatch[1]) {
          game.solution = solutionMatch[1].toUpperCase();
        } else {
          const upperMatch = fullText.match(/\\b([A-Z]{5})\\b/);
          if (upperMatch && upperMatch[1]) {
            game.solution = upperMatch[1];
          }
        }
        
        // Extract date
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
          
          const isoDate = testDate.toISOString().split('T')[0];
          if (isoDate) {
            game.date = isoDate;
          }
        }
        
        // Extract skill score
        const skillMatch = fullText.match(/(?:Your score was|score was|SKILL)[:\\s]+(\\d{1,3})/i);
        if (skillMatch && skillMatch[1]) {
          game.skillScore = parseInt(skillMatch[1], 10);
        }
        
        // Extract luck score
        const luckMatch = fullText.match(/(?:Your luck was|luck was|LUCK)[:\\s]+(\\d{1,3})/i);
        if (luckMatch && luckMatch[1]) {
          game.luckScore = parseInt(luckMatch[1], 10);
        }
        
        // Extract steps
        const stepsMatch = fullText.match(/(?:It took you|took you)[:\\s]+(\\d+|X)/i);
        if (stepsMatch && stepsMatch[1]) {
          const val = stepsMatch[1];
          if (val === 'X' || val === 'x') {
            game.steps = 0;
            game.won = false;
          } else {
            game.steps = parseInt(val, 10);
            game.won = true;
          }
        }
        
        return game;
      }
      
      // Test extraction on actual cards
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const results = {
        totalCards: cards.length,
        extractedGames: [],
        errors: []
      };
      
      Array.from(cards).slice(0, 3).forEach((card, idx) => {
        try {
          const game = extractGameFromCard(card);
          game.cardIndex = idx;
          results.extractedGames.push(game);
        } catch (error) {
          results.errors.push({
            cardIndex: idx,
            error: error.message
          });
        }
      });
      
      return results;
    });
    
    console.log('📊 EXTRACTION TEST RESULTS:');
    console.log('============================');
    console.log(`Total cards found: ${testResults.totalCards}`);
    console.log(`Games extracted: ${testResults.extractedGames.length}`);
    console.log(`Errors: ${testResults.errors.length}`);
    
    if (testResults.extractedGames.length > 0) {
      console.log('\n🎮 EXTRACTED GAMES:');
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
      
      console.log(`\n✅ SUCCESS: ${successfulExtractions}/${testResults.extractedGames.length} games fully extracted`);
      
      if (successfulExtractions === testResults.extractedGames.length) {
        console.log('🎉 EXTRACTION WORKS PERFECTLY!');
        console.log('📋 The extension should work. Check if:');
        console.log('   1. Extension is properly loaded');
        console.log('   2. Content script is injected');
        console.log('   3. Extension has permissions for this page');
      }
    } else {
      console.log('❌ NO GAMES EXTRACTED');
    }
    
    if (testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      testResults.errors.forEach(error => {
        console.log(`  Card ${error.cardIndex}: ${error.error}`);
      });
    }
    
    // Test if extension content script is present
    const extensionStatus = await page.evaluate(() => {
      return {
        hasContentScript: !!window.__wordleBotScraper,
        windowProperties: Object.keys(window).filter(k => k.includes('wordle') || k.includes('scrape')),
        extensionElements: document.querySelectorAll('[id*="extension"], [class*="extension"]').length
      };
    });
    
    console.log('\n🔌 EXTENSION STATUS:');
    console.log('===================');
    console.log(`Content script loaded: ${extensionStatus.hasContentScript}`);
    console.log(`Wordle-related window properties: ${extensionStatus.windowProperties}`);
    console.log(`Extension elements: ${extensionStatus.extensionElements}`);
    
    if (!extensionStatus.hasContentScript) {
      console.log('\n❌ EXTENSION ISSUE DETECTED');
      console.log('The content script is not loaded. Check:');
      console.log('1. Extension is enabled in edge://extensions/');
      console.log('2. Extension has permission for nytimes.com');
      console.log('3. Page was refreshed after loading extension');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testExtraction().catch(console.error);