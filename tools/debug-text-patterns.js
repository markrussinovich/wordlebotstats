/**
 * Debug the actual text content and patterns
 */

import { chromium } from 'playwright';

async function debugTextPatterns() {
  console.log('🔍 Debugging text patterns...\n');
  
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
    console.log('🔍 Analyzing card text patterns...');
    
    const analysis = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
      const results = {
        totalCards: cards.length,
        cardAnalysis: []
      };
      
      Array.from(cards).slice(0, 3).forEach((card, idx) => {
        const fullText = card.textContent || '';
        const cardData = {
          index: idx,
          fullText: fullText,
          textLength: fullText.length,
          patterns: {}
        };
        
        // Test all our patterns
        const patterns = {
          solution: [
            /solution was:\\s*([a-z]{5})/i,
            /solution was:\\s*([a-zA-Z]{5})/i,
            /solution was:\\s*([a-z]{5})/,
            /solution was: ([a-z]{5})/i,
            /solution was:([a-z]{5})/i,
            /\\bsolution was\\b.*?([a-z]{5})/i,
            /\\b([A-Z]{5})\\b/
          ],
          skill: [
            /Your score was:\\s*(\\d{1,3})/i,
            /Your score was: (\\d{1,3})/i,
            /score was:\\s*(\\d{1,3})/i,
            /score was: (\\d{1,3})/i,
            /\\bscore\\b.*?(\\d{1,3})/i
          ],
          luck: [
            /Your luck was:\\s*(\\d{1,3})/i,
            /Your luck was: (\\d{1,3})/i,
            /luck was:\\s*(\\d{1,3})/i,
            /luck was: (\\d{1,3})/i,
            /\\bluck\\b.*?(\\d{1,3})/i
          ],
          steps: [
            /It took you:\\s*(\\d+)/i,
            /It took you: (\\d+)/i,
            /took you:\\s*(\\d+)/i,
            /took you: (\\d+)/i,
            /(\\d+)guesses/i,
            /(\\d+) guesses/i
          ]
        };
        
        // Test each pattern type
        Object.entries(patterns).forEach(([type, patternList]) => {
          cardData.patterns[type] = {
            matches: [],
            successful: false
          };
          
          patternList.forEach((pattern, pIdx) => {
            const match = fullText.match(pattern);
            if (match) {
              cardData.patterns[type].matches.push({
                patternIndex: pIdx,
                pattern: pattern.toString(),
                match: match[0],
                captured: match[1] || null
              });
              cardData.patterns[type].successful = true;
            }
          });
        });
        
        // Look for key phrases
        const keyPhrases = [
          'solution was',
          'score was',
          'luck was', 
          'took you',
          'guesses'
        ];
        
        cardData.containsPhrases = {};
        keyPhrases.forEach(phrase => {
          const index = fullText.toLowerCase().indexOf(phrase);
          cardData.containsPhrases[phrase] = {
            found: index !== -1,
            index: index,
            context: index !== -1 ? fullText.slice(Math.max(0, index - 10), index + phrase.length + 10) : null
          };
        });
        
        results.cardAnalysis.push(cardData);
      });
      
      return results;
    });
    
    console.log(`📊 Analysis of ${analysis.totalCards} cards:\n`);
    
    analysis.cardAnalysis.forEach(card => {
      console.log(`🎴 CARD ${card.index + 1}:`);
      console.log('===============');
      console.log(`Text length: ${card.textLength} characters`);
      console.log(`Full text: "${card.fullText}"`);
      
      console.log('\\nKey phrases found:');
      Object.entries(card.containsPhrases).forEach(([phrase, data]) => {
        if (data.found) {
          console.log(`  ✅ "${phrase}" at position ${data.index}: "${data.context}"`);
        } else {
          console.log(`  ❌ "${phrase}" not found`);
        }
      });
      
      console.log('\\nPattern matches:');
      Object.entries(card.patterns).forEach(([type, results]) => {
        if (results.successful) {
          console.log(`  ✅ ${type.toUpperCase()}:`);
          results.matches.forEach(match => {
            console.log(`     Pattern ${match.patternIndex}: ${match.pattern}`);
            console.log(`     Match: "${match.match}"`);
            console.log(`     Captured: "${match.captured}"`);
          });
        } else {
          console.log(`  ❌ ${type.toUpperCase()}: No matches found`);
        }
      });
      
      console.log('\\n' + '='.repeat(50) + '\\n');
    });
    
    // Summary
    const successfulCards = analysis.cardAnalysis.filter(card => 
      card.patterns.solution.successful && card.patterns.skill.successful
    ).length;
    
    console.log(`📈 SUMMARY:`);
    console.log(`Cards with successful solution extraction: ${analysis.cardAnalysis.filter(c => c.patterns.solution.successful).length}/${analysis.totalCards}`);
    console.log(`Cards with successful skill extraction: ${analysis.cardAnalysis.filter(c => c.patterns.skill.successful).length}/${analysis.totalCards}`);
    console.log(`Cards with both solution and skill: ${successfulCards}/${analysis.totalCards}`);
    
    if (successfulCards === 0) {
      console.log('\\n🚨 NO CARDS SUCCESSFULLY EXTRACTED!');
      console.log('Need to fix the regex patterns based on the actual text format shown above.');
    } else {
      console.log('\\n✅ EXTRACTION PATTERNS WORK!');
      console.log('The issue must be elsewhere in the extension.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugTextPatterns().catch(console.error);