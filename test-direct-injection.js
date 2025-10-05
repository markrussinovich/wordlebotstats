/**
 * Test direct script injection in browser
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function testDirectInjection() {
  console.log('🧪 Testing direct script injection...\n');
  
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
    
    // Read the content script
    const contentScript = fs.readFileSync('C:\\source\\Wordle\\dist\\wordleBotContent.js', 'utf8');
    
    console.log('💉 Injecting content script directly...');
    
    // Inject the script
    await page.evaluate(contentScript);
    
    console.log('✅ Script injected');
    
    // Test if it worked
    const testResults = await page.evaluate(() => {
      return {
        scraperExists: !!window.__wordleBotScraper,
        gameCardsFound: document.querySelectorAll('.rating-container.svelte-pnoxcy').length,
        extractedGames: window.__wordleBotScraper ? window.__wordleBotScraper.extractVisibleGames() : null
      };
    });
    
    console.log('📊 Test Results:');
    console.log('Scraper exists:', testResults.scraperExists);
    console.log('Game cards found:', testResults.gameCardsFound);
    
    if (testResults.extractedGames) {
      console.log('Extracted games:', testResults.extractedGames.length);
      
      if (testResults.extractedGames.length > 0) {
        console.log('\n🎮 First extracted game:');
        const firstGame = testResults.extractedGames[0];
        console.log('  Solution:', firstGame.solution);
        console.log('  Date:', firstGame.dateString);
        console.log('  Skill Score:', firstGame.skillScore);
        console.log('  Luck Score:', firstGame.luckScore);
        console.log('  Steps:', firstGame.steps);
        console.log('  Won:', firstGame.won);
      }
    }
    
    // Test manual trigger
    if (testResults.scraperExists) {
      console.log('\n🚀 Testing manual scrape trigger...');
      
      const manualTest = await page.evaluate(async () => {
        try {
          await window.__wordleBotScraper.startScraping('full', null, 2);
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      console.log('Manual scrape test:', manualTest);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectInjection().catch(console.error);