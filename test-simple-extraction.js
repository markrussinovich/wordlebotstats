/**
 * Simple extraction test - direct evaluation
 */

import { chromium } from 'playwright';

async function testSimpleExtraction() {
  console.log('🧪 Testing simple extraction...\n');
  
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
    
    console.log('📄 Found WordleBot page');
    console.log('🧪 Testing direct extraction...');
    
    const result = await page.evaluate(() => {
      // Test basic card finding
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      
      if (cards.length === 0) {
        return { 
          error: 'No cards found',
          totalElements: document.querySelectorAll('*').length
        };
      }
      
      // Test extraction on first card
      const firstCard = cards[0];
      const fullText = firstCard.textContent || '';
      
      const result = {
        totalCards: cards.length,
        firstCardText: fullText,
        textLength: fullText.length,
        patterns: {}
      };
      
      // Test each pattern individually
      const tests = [
        { name: 'solution', pattern: /solution was: ([a-z]{5})/i },
        { name: 'skill', pattern: /Your score was: (\d{1,3})/i },
        { name: 'luck', pattern: /Your luck was: (\d{1,3})/i },
        { name: 'steps', pattern: /It took you: (\d+)guesses/i }
      ];
      
      tests.forEach(test => {
        const match = fullText.match(test.pattern);
        result.patterns[test.name] = {
          pattern: test.pattern.toString(),
          matched: !!match,
          fullMatch: match ? match[0] : null,
          captured: match ? match[1] : null
        };
      });
      
      return result;
    });
    
    console.log('📊 DIRECT EXTRACTION TEST RESULTS:');
    console.log('==================================');
    
    if (result.error) {
      console.log('❌ Error:', result.error);
      console.log('Total elements on page:', result.totalElements);
      return;
    }
    
    console.log('Total cards found:', result.totalCards);
    console.log('Text length:', result.textLength);
    console.log('First card text:', result.firstCardText);
    
    console.log('\nPattern test results:');
    Object.entries(result.patterns).forEach(([name, data]) => {
      const status = data.matched ? '✅' : '❌';
      console.log(`${status} ${name.toUpperCase()}:`);
      console.log(`   Pattern: ${data.pattern}`);
      if (data.matched) {
        console.log(`   Match: "${data.fullMatch}"`);
        console.log(`   Captured: "${data.captured}"`);
      } else {
        console.log(`   No match found`);
      }
    });
    
    // Count successful patterns
    const successfulPatterns = Object.values(result.patterns).filter(p => p.matched).length;
    console.log(`\n🎯 SUCCESS RATE: ${successfulPatterns}/${Object.keys(result.patterns).length} patterns matched`);
    
    if (successfulPatterns === Object.keys(result.patterns).length) {
      console.log('🎉 ALL PATTERNS WORK! The issue must be in the extraction loop logic.');
    } else {
      console.log('🔧 Some patterns need fixing. Check the failed patterns above.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimpleExtraction().catch(console.error);