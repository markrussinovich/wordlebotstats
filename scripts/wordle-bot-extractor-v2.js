/**
 * Wordle Bot Game Extractor - Version 2
 * Enhanced based on initial analysis results
 * 
 * Run this in the browser console on:
 * https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html
 * 
 * Key findings from initial analysis:
 * - Found div[class*="game"] (82 elements)
 * - Found div[class*="score"] (1 element - container)
 * - Found div[class*="result"] (1 element - wordle-results container)
 * - No "Load More" button found (likely infinite scroll or all loaded)
 */

(function() {
  console.log('=== Wordle Bot Game Extractor v2 ===\n');
  
  // STEP 1: Find the main container
  console.log('--- Step 1: Finding main container ---');
  const resultsContainer = document.querySelector('#g-wordle-results.wordle-results');
  const pastScoresContainer = document.querySelector('.past-scores-container');
  
  console.log('Results container:', resultsContainer);
  console.log('Past scores container:', pastScoresContainer);
  
  if (!resultsContainer && !pastScoresContainer) {
    console.error('❌ Could not find game container!');
    return;
  }
  
  const mainContainer = resultsContainer || pastScoresContainer;
  console.log('✓ Using container:', mainContainer);
  
  // STEP 2: Analyze the structure
  console.log('\n--- Step 2: Analyzing container structure ---');
  console.log('Container HTML (first 500 chars):', mainContainer.outerHTML.slice(0, 500));
  
  // Look for direct children
  const children = Array.from(mainContainer.children);
  console.log(`Found ${children.length} direct children`);
  
  if (children.length > 0) {
    console.log('First child:', children[0]);
    console.log('First child classes:', children[0].className);
    console.log('First child HTML (first 300 chars):', children[0].outerHTML.slice(0, 300));
  }
  
  // STEP 3: Find individual game cards
  console.log('\n--- Step 3: Finding individual game cards ---');
  
  // Try various selectors for game cards
  const gameCardSelectors = [
    '.past-scores-container > div',
    '.past-scores-container > *',
    '#g-wordle-results > div',
    '#g-wordle-results > *',
    '[class*="past-score"]',
    '[class*="game-row"]',
    '[class*="score-row"]',
    '[class*="wordle-game"]'
  ];
  
  let gameCards = [];
  let workingSelector = null;
  
  for (const selector of gameCardSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✓ Selector "${selector}" found ${elements.length} elements`);
      if (elements.length > gameCards.length) {
        gameCards = Array.from(elements);
        workingSelector = selector;
      }
    }
  }
  
  console.log(`\nBest selector: "${workingSelector}" with ${gameCards.length} cards`);
  
  // STEP 4: Extract data from first few game cards
  console.log('\n--- Step 4: Extracting data from game cards ---');
  
  function extractGameData(card, index) {
    const text = card.textContent;
    const html = card.outerHTML;
    
    console.log(`\n--- Card ${index} ---`);
    console.log('Text content:', text.slice(0, 200));
    console.log('HTML (first 400 chars):', html.slice(0, 400));
    
    // Extract patterns
    const game = {
      index,
      raw: {
        text: text.trim(),
        html: html.slice(0, 500)
      }
    };
    
    // Try to find the word (5 uppercase letters)
    const wordMatch = text.match(/\b([A-Z]{5})\b/);
    if (wordMatch) {
      game.solution = wordMatch[1];
      console.log('  Solution:', game.solution);
    }
    
    // Try to find the date
    const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
    if (dateMatch) {
      game.date = `${dateMatch[1]} ${dateMatch[2]}`;
      console.log('  Date:', game.date);
    }
    
    // Try to find game number
    const gameNumberMatch = text.match(/(?:Game|#|Wordle)\s*#?\s*(\d+)/i);
    if (gameNumberMatch) {
      game.gameNumber = parseInt(gameNumberMatch[1]);
      console.log('  Game Number:', game.gameNumber);
    }
    
    // Try to find skill score
    const skillMatch = text.match(/[Ss]kill[:\s]*(\d+)/);
    if (skillMatch) {
      game.skillScore = parseInt(skillMatch[1]);
      console.log('  Skill:', game.skillScore);
    }
    
    // Try to find luck score
    const luckMatch = text.match(/[Ll]uck[:\s]*(\d+)/);
    if (luckMatch) {
      game.luckScore = parseInt(luckMatch[1]);
      console.log('  Luck:', game.luckScore);
    }
    
    // Try to find steps/guesses
    const stepsMatch = text.match(/[Ss]teps?[:\s]*(\d+|X)/);
    if (stepsMatch) {
      game.steps = stepsMatch[1] === 'X' ? 0 : parseInt(stepsMatch[1]);
      game.won = stepsMatch[1] !== 'X';
      console.log('  Steps:', stepsMatch[1], '(Won:', game.won, ')');
    }
    
    // Look for links
    const links = card.querySelectorAll('a');
    if (links.length > 0) {
      game.analysisUrl = links[0].href;
      console.log('  Analysis URL:', game.analysisUrl);
    }
    
    // Try to find visual grid (the colored squares)
    const gridElements = card.querySelectorAll('[class*="grid"], [class*="row"], svg, canvas');
    if (gridElements.length > 0) {
      console.log('  Found', gridElements.length, 'visual elements (grid/rows)');
      game.hasVisualGrid = true;
    }
    
    return game;
  }
  
  // Extract first 3 games as samples
  const sampleGames = gameCards.slice(0, 3).map((card, idx) => extractGameData(card, idx));
  
  // STEP 5: Check for pagination or lazy loading
  console.log('\n--- Step 5: Checking for pagination/lazy loading ---');
  
  const paginationElements = document.querySelectorAll('[class*="load"], [class*="more"], [class*="page"], [class*="next"]');
  console.log('Pagination-like elements:', paginationElements.length);
  
  paginationElements.forEach((el, idx) => {
    if (idx < 5) {
      console.log(`  ${idx + 1}. ${el.tagName} - Class: "${el.className}" - Text: "${el.textContent.slice(0, 50)}"`);
    }
  });
  
  // Check if page is scrollable (infinite scroll?)
  const isScrollable = document.documentElement.scrollHeight > window.innerHeight;
  console.log('Page is scrollable:', isScrollable);
  console.log('Current scroll position:', window.scrollY);
  console.log('Page height:', document.documentElement.scrollHeight);
  console.log('Viewport height:', window.innerHeight);
  
  // STEP 6: Look for embedded data or API calls
  console.log('\n--- Step 6: Looking for embedded data ---');
  
  // Check for inline JSON in script tags
  const scripts = document.querySelectorAll('script:not([src])');
  console.log(`Found ${scripts.length} inline script tags`);
  
  let foundData = false;
  scripts.forEach((script, idx) => {
    const content = script.textContent;
    if ((content.includes('wordle') || content.includes('score')) && content.includes('{')) {
      console.log(`  Script ${idx} might contain game data (${content.length} chars)`);
      
      // Try to extract JSON
      try {
        const jsonMatches = content.match(/(\{[^{}]*(?:"wordle"|"score"|"game")[^{}]*\})/gi);
        if (jsonMatches && jsonMatches.length > 0 && !foundData) {
          console.log('  Potential JSON found:', jsonMatches[0].slice(0, 200));
          foundData = true;
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
  });
  
  // Check window globals
  console.log('\n--- Step 7: Checking for global data ---');
  const globalKeys = Object.keys(window).filter(key => 
    key.toLowerCase().includes('wordle') || 
    key.toLowerCase().includes('game') ||
    key.toLowerCase().includes('score')
  );
  
  console.log('Relevant global variables:', globalKeys);
  globalKeys.slice(0, 5).forEach(key => {
    console.log(`  ${key}:`, typeof window[key]);
  });
  
  // STEP 8: Create extraction summary
  console.log('\n--- EXTRACTION SUMMARY ---');
  
  const summary = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    
    // Findings
    mainContainerSelector: workingSelector,
    totalCardsFound: gameCards.length,
    hasPagination: paginationElements.length > 0,
    isScrollable: isScrollable,
    
    // Sample data
    sampleGames: sampleGames.map(g => ({
      solution: g.solution,
      date: g.date,
      gameNumber: g.gameNumber,
      skillScore: g.skillScore,
      luckScore: g.luckScore,
      steps: g.steps,
      won: g.won
    })),
    
    // Strategy
    recommendedApproach: null
  };
  
  // Determine scraping strategy
  if (gameCards.length > 0 && sampleGames[0].solution) {
    summary.recommendedApproach = 'DOM_SCRAPING';
    console.log('✅ Recommended approach: DOM SCRAPING');
    console.log('   - Game cards are present in DOM');
    console.log('   - Data can be extracted from HTML structure');
    console.log('   - Use selector:', workingSelector);
  } else if (paginationElements.length > 0) {
    summary.recommendedApproach = 'PAGINATION_SCRAPING';
    console.log('✅ Recommended approach: PAGINATION with SCRAPING');
    console.log('   - Load more content first, then scrape');
  } else if (isScrollable) {
    summary.recommendedApproach = 'INFINITE_SCROLL_SCRAPING';
    console.log('✅ Recommended approach: INFINITE SCROLL + SCRAPING');
    console.log('   - Scroll to load more content, then scrape');
  } else {
    summary.recommendedApproach = 'API_OR_EMBEDDED_DATA';
    console.log('⚠️  Recommended approach: Look for API or embedded data');
    console.log('   - Game cards not clearly visible in DOM');
    console.log('   - May need to find hidden API or data source');
  }
  
  console.log('\nExtracted sample games:', summary.sampleGames);
  console.log('\nFull summary:', summary);
  
  // STEP 9: Create a full extraction function
  console.log('\n--- Step 9: Creating full extraction function ---');
  
  function extractAllGames() {
    console.log('Extracting all visible games...');
    
    const cards = document.querySelectorAll(workingSelector);
    const games = [];
    
    cards.forEach((card, idx) => {
      try {
        const text = card.textContent;
        
        // Extract data
        const game = {};
        
        const wordMatch = text.match(/\b([A-Z]{5})\b/);
        if (wordMatch) game.solution = wordMatch[1];
        
        const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
        if (dateMatch) game.date = `${dateMatch[1]} ${dateMatch[2]}`;
        
        const gameNumberMatch = text.match(/(?:Game|#|Wordle)\s*#?\s*(\d+)/i);
        if (gameNumberMatch) game.gameNumber = parseInt(gameNumberMatch[1]);
        
        const skillMatch = text.match(/[Ss]kill[:\s]*(\d+)/);
        if (skillMatch) game.skillScore = parseInt(skillMatch[1]);
        
        const luckMatch = text.match(/[Ll]uck[:\s]*(\d+)/);
        if (luckMatch) game.luckScore = parseInt(luckMatch[1]);
        
        const stepsMatch = text.match(/[Ss]teps?[:\s]*(\d+|X)/);
        if (stepsMatch) {
          game.steps = stepsMatch[1] === 'X' ? 0 : parseInt(stepsMatch[1]);
          game.won = stepsMatch[1] !== 'X';
        }
        
        const links = card.querySelectorAll('a');
        if (links.length > 0) game.analysisUrl = links[0].href;
        
        // Only add if we got meaningful data
        if (game.solution || game.gameNumber) {
          games.push(game);
        }
      } catch (e) {
        console.warn(`Failed to extract game ${idx}:`, e);
      }
    });
    
    console.log(`✅ Extracted ${games.length} games`);
    return games;
  }
  
  // Make functions available globally
  window.__WORDLE_EXTRACTOR__ = {
    summary,
    extractAllGames,
    extractGameData,
    gameCards,
    workingSelector
  };
  
  console.log('\n✅ Analysis complete!');
  console.log('📦 Results stored in window.__WORDLE_EXTRACTOR__');
  console.log('🎮 To extract all games, run: window.__WORDLE_EXTRACTOR__.extractAllGames()');
  console.log('📊 To see summary, run: window.__WORDLE_EXTRACTOR__.summary');
  
  return summary;
})();
