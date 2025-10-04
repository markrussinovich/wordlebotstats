/**
 * Wordle Bot Game Extractor - Version 5
 * Fixed based on actual DOM structure findings
 * 
 * Key findings from v4:
 * - Game cards have class: .rating-container.svelte-pnoxcy
 * - Text contains: "The Game Number and solution was: [word]"
 * - Need to find "View analysis" links or look deeper in structure
 */

(function() {
  console.log('=== Wordle Bot Game Extractor v5 ===\n');
  
  // Find game cards with the correct class
  console.log('--- Finding game cards ---');
  const gameCards = Array.from(document.querySelectorAll('.rating-container.svelte-pnoxcy'));
  console.log(`Found ${gameCards.length} potential game cards`);
  
  if (gameCards.length === 0) {
    console.error('❌ No game cards found!');
    return;
  }
  
  // Analyze first card in detail
  console.log('\n--- Analyzing first game card structure ---');
  const firstCard = gameCards[0];
  console.log('Full text:', firstCard.textContent);
  console.log('\nHTML structure (first 800 chars):', firstCard.outerHTML.slice(0, 800));
  
  // Look for nested elements
  console.log('\nNested elements:');
  console.log('  All divs:', firstCard.querySelectorAll('div').length);
  console.log('  All spans:', firstCard.querySelectorAll('span').length);
  console.log('  All links:', firstCard.querySelectorAll('a').length);
  
  // Check for elements with specific classes
  const allElements = firstCard.querySelectorAll('*');
  const classesFound = new Set();
  allElements.forEach(el => {
    if (el.className) {
      el.className.split(' ').forEach(cls => classesFound.add(cls));
    }
  });
  console.log('\nUnique classes in first card:', Array.from(classesFound).slice(0, 20));
  
  // Look for value elements
  console.log('\nLooking for value elements:');
  const valueElements = firstCard.querySelectorAll('[class*="value"], [class*="score"], [class*="rating"]');
  console.log(`  Found ${valueElements.length} value-like elements`);
  Array.from(valueElements).slice(0, 5).forEach((el, idx) => {
    console.log(`    ${idx}: ${el.className} = "${el.textContent.trim()}"`);
  });
  
  // Function to extract game data
  function extractGameFromCard(card) {
    const game = {};
    
    try {
      const fullText = card.textContent;
      
      // Extract solution word from "The Game Number and solution was: [word]"
      const solutionMatch = fullText.match(/solution was:\s*([a-z]{5})/i);
      if (solutionMatch) {
        game.solution = solutionMatch[1].toUpperCase();
      }
      
      // Try to find solution in uppercase too
      if (!game.solution) {
        const upperMatch = fullText.match(/\b([A-Z]{5})\b/);
        if (upperMatch) game.solution = upperMatch[1];
      }
      
      // Extract date
      const dateMatch = fullText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
      if (dateMatch) {
        game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
        
        const month = dateMatch[1];
        const day = parseInt(dateMatch[2]);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        
        let testDate = new Date(`${month} ${day}, ${currentYear}`);
        if (testDate > currentDate) {
          testDate = new Date(`${month} ${day}, ${currentYear - 1}`);
        }
        
        game.date = testDate.toISOString().split('T')[0];
      }
      
      // Extract game number
      const gameNumMatch = fullText.match(/Game Number[^:]*:\s*(\d{3,4})|#(\d{3,4})|Wordle\s+(\d{3,4})/i);
      if (gameNumMatch) {
        game.gameNumber = parseInt(gameNumMatch[1] || gameNumMatch[2] || gameNumMatch[3]);
      }
      
      // Extract skill score - "Your score was: 89"
      const skillMatch = fullText.match(/(?:Your score was|score was|SKILL)[:\s]+(\d{1,3})/i);
      if (skillMatch) {
        game.skillScore = parseInt(skillMatch[1]);
      }
      
      // Extract luck score - "Your luck was: 58"
      const luckMatch = fullText.match(/(?:Your luck was|luck was|LUCK)[:\s]+(\d{1,3})/i);
      if (luckMatch) {
        game.luckScore = parseInt(luckMatch[1]);
      }
      
      // Extract steps - "It took you: 3guesses" or could be "X"
      const stepsMatch = fullText.match(/(?:It took you|took you)[:\s]+(\d+|X)/i);
      if (stepsMatch) {
        const val = stepsMatch[1];
        if (val === 'X' || val === 'x') {
          game.steps = 0;
          game.won = false;
        } else {
          game.steps = parseInt(val);
          game.won = true;
        }
      }
      
      // Get link if exists
      const link = card.querySelector('a[href*="analysis"], a[href*="wordle"]');
      if (link && !link.href.includes('index.html')) {
        game.analysisUrl = link.href;
      }
      
    } catch (e) {
      console.error('Error extracting game:', e);
    }
    
    return game;
  }
  
  // Extract first few games
  console.log('\n--- Extracting first 5 games ---');
  const samples = gameCards.slice(0, 5).map((card, idx) => {
    const game = extractGameFromCard(card);
    game.index = idx;
    console.log(`\nGame ${idx}:`, {
      solution: game.solution,
      date: game.dateString,
      gameNumber: game.gameNumber,
      skill: game.skillScore,
      luck: game.luckScore,
      steps: game.steps,
      won: game.won
    });
    return game;
  });
  
  // Find Show More button
  console.log('\n--- Finding pagination button ---');
  const showMoreBtn = document.querySelector('.show-more-button.svelte-151vgtd');
  console.log('Show more button:', showMoreBtn);
  console.log('Button visible:', showMoreBtn ? (showMoreBtn.offsetParent !== null) : false);
  
  // Create extraction functions
  function extractAllGames() {
    const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
    const games = [];
    
    cards.forEach((card, idx) => {
      const game = extractGameFromCard(card);
      if (game.solution || game.gameNumber) {
        games.push(game);
      }
    });
    
    console.log(`Extracted ${games.length} games`);
    return games;
  }
  
  async function loadMoreGames() {
    const btn = document.querySelector('.show-more-button.svelte-151vgtd');
    if (!btn || btn.offsetParent === null) {
      console.log('❌ No more games to load');
      return false;
    }
    
    const beforeCount = document.querySelectorAll('.rating-container.svelte-pnoxcy').length;
    console.log(`Before: ${beforeCount} cards`);
    
    btn.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterCount = document.querySelectorAll('.rating-container.svelte-pnoxcy').length;
    const newCards = afterCount - beforeCount;
    
    console.log(`After: ${afterCount} cards (+${newCards})`);
    return newCards > 0;
  }
  
  async function scrapeAllGames(maxIterations = 20) {
    console.log('\n🚀 Starting full scrape...');
    
    const allGames = new Map();
    let iteration = 0;
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n--- Iteration ${iteration} ---`);
      
      const games = extractAllGames();
      console.log(`  Found ${games.length} games on page`);
      
      games.forEach(game => {
        const key = game.gameNumber || game.date || game.solution;
        if (key) {
          allGames.set(key, game);
        }
      });
      
      console.log(`  Total unique: ${allGames.size}`);
      
      const hasMore = await loadMoreGames();
      if (!hasMore) {
        console.log('✅ No more pages');
        break;
      }
    }
    
    if (iteration >= maxIterations) {
      console.warn(`⚠️ Stopped at max iterations (${maxIterations})`);
    }
    
    const result = Array.from(allGames.values())
      .sort((a, b) => {
        const aNum = a.gameNumber || 0;
        const bNum = b.gameNumber || 0;
        return bNum - aNum; // Newest first
      });
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   Total games: ${result.length}`);
    if (result.length > 0) {
      console.log(`   Newest: ${result[0]?.solution} (${result[0]?.dateString})`);
      console.log(`   Oldest: ${result[result.length-1]?.solution} (${result[result.length-1]?.dateString})`);
    }
    
    return result;
  }
  
  // Summary
  const summary = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    gameCardsFound: gameCards.length,
    hasShowMoreButton: !!showMoreBtn,
    selector: '.rating-container.svelte-pnoxcy',
    showMoreButtonSelector: '.show-more-button.svelte-151vgtd',
    samples: samples.map(g => ({
      solution: g.solution,
      date: g.date,
      gameNumber: g.gameNumber,
      skillScore: g.skillScore,
      luckScore: g.luckScore,
      steps: g.steps,
      won: g.won
    }))
  };
  
  console.log('\n--- SUMMARY ---');
  console.log(summary);
  
  // Export
  window.__WORDLE_EXTRACTOR_V5__ = {
    summary,
    gameCards,
    extractAllGames,
    loadMoreGames,
    scrapeAllGames,
    extractGameFromCard
  };
  
  console.log('\n✅ Ready!');
  console.log('📊 Summary: window.__WORDLE_EXTRACTOR_V5__.summary');
  console.log('🎮 Extract visible: window.__WORDLE_EXTRACTOR_V5__.extractAllGames()');
  console.log('➕ Load more: await window.__WORDLE_EXTRACTOR_V5__.loadMoreGames()');
  console.log('🚀 SCRAPE ALL: await window.__WORDLE_EXTRACTOR_V5__.scrapeAllGames()');
  
  return summary;
})();
