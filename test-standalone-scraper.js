/**
 * Test standalone scraper without chrome extension APIs
 */

import { chromium } from 'playwright';

async function testStandaloneScraper() {
  console.log('🧪 Testing standalone scraper...\n');
  
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
      console.log('❌ WordleBot page not found');
      return;
    }
    
    console.log('📄 Found WordleBot page');
    console.log('💉 Injecting standalone scraper...');
    
    // Inject standalone scraper
    const testResults = await page.evaluate(() => {
      // Standalone scraper class without chrome extension APIs
      class StandaloneScraper {
        constructor() {
          this.GAME_CARD_SELECTOR = '.rating-container.svelte-pnoxcy';
          this.SHOW_MORE_BUTTON_SELECTOR = '.show-more-button.svelte-151vgtd';
        }

        extractGameFromCard(card) {
          const game = {};
          const fullText = card.textContent || '';
          
          console.log('=== EXTRACTING FROM CARD ===');
          console.log('Full text length:', fullText.length);
          console.log('Full text:', JSON.stringify(fullText));
          console.log('Text preview:', fullText.slice(0, 200));

          // Extract solution word
          console.log('Testing solution pattern...');
          const solutionMatch = fullText.match(/solution was:\s*([a-z]{5})/i);
          console.log('Solution match result:', solutionMatch);
          if (solutionMatch && solutionMatch[1]) {
            game.solution = solutionMatch[1].toUpperCase();
            console.log('✅ Solution extracted:', game.solution);
          } else {
            console.log('❌ Solution not found');
          }

          // Extract date
          console.log('Testing date pattern...');
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
          console.log('Testing skill pattern...');
          const skillMatch = fullText.match(/Your score was: (\d{1,3})/i);
          console.log('Skill match result:', skillMatch);
          if (skillMatch && skillMatch[1]) {
            game.skillScore = parseInt(skillMatch[1], 10);
            console.log('✅ Skill extracted:', game.skillScore);
          } else {
            console.log('❌ Skill not found');
          }

          // Extract luck score
          console.log('Testing luck pattern...');
          const luckMatch = fullText.match(/Your luck was: (\d{1,3})/i);
          console.log('Luck match result:', luckMatch);
          if (luckMatch && luckMatch[1]) {
            game.luckScore = parseInt(luckMatch[1], 10);
            console.log('✅ Luck extracted:', game.luckScore);
          } else {
            console.log('❌ Luck not found');
          }

          // Extract steps
          console.log('Testing steps pattern...');
          const stepsMatch = fullText.match(/It took you: (\d+)guesses/i);
          console.log('Steps match result:', stepsMatch);
          if (stepsMatch && stepsMatch[1]) {
            game.steps = parseInt(stepsMatch[1], 10);
            game.won = true;
            console.log('✅ Steps extracted:', game.steps);
          } else {
            console.log('❌ Steps not found');
          }

          return game;
        }

        extractVisibleGames() {
          console.log('=== Starting extractVisibleGames ===');
          
          const cards = document.querySelectorAll(this.GAME_CARD_SELECTOR);
          const games = [];

          console.log(`Found ${cards.length} cards with selector ${this.GAME_CARD_SELECTOR}`);
          
          if (cards.length === 0) {
            console.log('No cards found! Trying alternative selectors...');
            const altCards = document.querySelectorAll('.rating-container');
            console.log(`Found ${altCards.length} cards with .rating-container`);
            return [];
          }

          cards.forEach((card, idx) => {
            console.log(`Processing card ${idx}...`);
            
            try {
              console.log(`\n🎴 Processing card ${idx}...`);
              const game = this.extractGameFromCard(card);
              game.cardIndex = idx;
              
              console.log(`\n📊 Card ${idx} extraction result:`, JSON.stringify(game, null, 2));
              
              if (game.solution || game.skillScore) {
                games.push(game);
                console.log(`✅ Card ${idx}: ${game.solution} - Score: ${game.skillScore}, Luck: ${game.luckScore}, Steps: ${game.steps}`);
              } else {
                console.log(`❌ Card ${idx}: No data extracted - ${Object.keys(game).length} fields found`);
              }
            } catch (error) {
              console.error(`💥 Error extracting card ${idx}:`, error);
            }
          });

          console.log(`=== Finished extractVisibleGames: ${games.length} games extracted ===`);
          return games;
        }
        
        async testPagination() {
          const btn = document.querySelector(this.SHOW_MORE_BUTTON_SELECTOR);
          console.log('Show more button:', btn);
          console.log('Button visible:', btn ? (btn.offsetParent !== null) : false);
          console.log('Button text:', btn ? btn.textContent.trim() : 'N/A');
          
          if (btn && btn.offsetParent !== null) {
            const beforeCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
            console.log(`Before click: ${beforeCount} cards`);
            
            btn.click();
            
            // Wait for new content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const afterCount = document.querySelectorAll(this.GAME_CARD_SELECTOR).length;
            const newCards = afterCount - beforeCount;
            
            console.log(`After click: ${afterCount} cards (+${newCards})`);
            
            return {
              success: newCards > 0,
              beforeCount,
              afterCount,
              newCards
            };
          }
          
          return { success: false, reason: 'Button not found or not visible' };
        }
      }

      // Create scraper and test
      const scraper = new StandaloneScraper();
      window.__testScraper = scraper;
      
      console.log('🧪 Testing extraction...');
      const extractedGames = scraper.extractVisibleGames();
      
      return {
        totalCards: document.querySelectorAll(scraper.GAME_CARD_SELECTOR).length,
        extractedGames: extractedGames,
        successfulExtractions: extractedGames.filter(g => g.solution && g.skillScore).length
      };
    });
    
    console.log('📊 EXTRACTION RESULTS:');
    console.log('======================');
    console.log(`Total cards found: ${testResults.totalCards}`);
    console.log(`Games extracted: ${testResults.extractedGames.length}`);
    console.log(`Successful extractions: ${testResults.successfulExtractions}`);
    
    if (testResults.extractedGames.length > 0) {
      console.log('\n🎮 EXTRACTED GAMES:');
      testResults.extractedGames.slice(0, 3).forEach((game, idx) => {
        console.log(`\nGame ${idx + 1}:`);
        console.log(`  Solution: ${game.solution || 'NOT FOUND'}`);
        console.log(`  Date: ${game.dateString || 'NOT FOUND'} (${game.date || 'NO ISO DATE'})`);
        console.log(`  Skill Score: ${game.skillScore || 'NOT FOUND'}`);
        console.log(`  Luck Score: ${game.luckScore || 'NOT FOUND'}`);
        console.log(`  Steps: ${game.steps !== undefined ? game.steps : 'NOT FOUND'}`);
        console.log(`  Won: ${game.won !== undefined ? game.won : 'NOT FOUND'}`);
      });
    }
    
    if (testResults.successfulExtractions > 0) {
      console.log('\n✅ EXTRACTION WORKS! Testing pagination...');
      
      const paginationTest = await page.evaluate(async () => {
        return await window.__testScraper.testPagination();
      });
      
      console.log('\n📄 PAGINATION TEST:');
      console.log('==================');
      console.log('Success:', paginationTest.success);
      if (paginationTest.beforeCount !== undefined) {
        console.log(`Cards before: ${paginationTest.beforeCount}`);
        console.log(`Cards after: ${paginationTest.afterCount}`);
        console.log(`New cards: ${paginationTest.newCards}`);
      } else {
        console.log('Reason:', paginationTest.reason);
      }
      
      if (paginationTest.success) {
        console.log('\n🎉 BOTH EXTRACTION AND PAGINATION WORK!');
        console.log('   The issue is with the extension loading mechanism.');
      }
    } else {
      console.log('\n❌ EXTRACTION FAILED');
      console.log('   Need to debug the regex patterns.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testStandaloneScraper().catch(console.error);