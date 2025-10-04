/**
 * Wordle Bot Game Extractor - Version 4
 * Debug version to find the actual game card structure
 * 
 * This version inspects the DOM more carefully to find game cards
 */

(function() {
  console.log('=== Wordle Bot Game Extractor v4 (Debug) ===\n');
  
  // STEP 1: Find the container
  console.log('--- Step 1: Finding container ---');
  const container = document.querySelector('#g-wordle-results');
  if (!container) {
    console.error('❌ Container #g-wordle-results not found!');
    return;
  }
  console.log('✅ Found container:', container);
  
  // STEP 2: Examine ALL direct children
  console.log('\n--- Step 2: Examining all direct children ---');
  const children = Array.from(container.children);
  console.log(`Total children: ${children.length}`);
  
  // Show first 10 children with details
  children.slice(0, 10).forEach((child, idx) => {
    console.log(`\nChild ${idx}:`);
    console.log('  Tag:', child.tagName);
    console.log('  Classes:', child.className);
    console.log('  Text (first 100):', child.textContent.slice(0, 100).trim());
    console.log('  HTML (first 200):', child.outerHTML.slice(0, 200));
  });
  
  // STEP 3: Look for elements containing game data
  console.log('\n--- Step 3: Finding elements with game data ---');
  
  // Strategy: Look for elements containing BOTH:
  // - A 5-letter word in caps (solution)
  // - The word "SKILL" or "Skill"
  const potentialGameCards = children.filter(child => {
    const text = child.textContent;
    const hasWord = /\b[A-Z]{5}\b/.test(text);
    const hasSkill = /skill/i.test(text);
    const hasLuck = /luck/i.test(text);
    return hasWord && hasSkill && hasLuck;
  });
  
  console.log(`Found ${potentialGameCards.length} elements with game data`);
  
  if (potentialGameCards.length > 0) {
    console.log('\n--- Analyzing potential game cards ---');
    potentialGameCards.slice(0, 3).forEach((card, idx) => {
      console.log(`\nPotential Card ${idx}:`);
      console.log('  Tag:', card.tagName);
      console.log('  Classes:', card.className);
      console.log('  Text:', card.textContent.slice(0, 150));
      console.log('  Has link:', card.querySelectorAll('a').length > 0);
      console.log('  HTML (first 300):', card.outerHTML.slice(0, 300));
    });
  }
  
  // STEP 4: Try alternative selectors
  console.log('\n--- Step 4: Trying alternative selectors ---');
  
  const alternativeSelectors = [
    '#g-wordle-results > div',
    '#g-wordle-results > *',
    '#g-wordle-results [class*="rating"]',
    '#g-wordle-results .rating-container',
    '#g-wordle-results > div.rating-container',
    '.past-scores-container .rating-container',
    'div[class*="svelte"]',
    'a[href*="wordle"]'
  ];
  
  alternativeSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`\n✓ "${selector}": ${elements.length} elements`);
        if (elements.length < 100 && elements.length > 3) {
          const first = elements[0];
          console.log('  First element classes:', first.className);
          console.log('  First element text (50 chars):', first.textContent.slice(0, 50).trim());
        }
      }
    } catch (e) {
      console.log(`  ✗ "${selector}": Error - ${e.message}`);
    }
  });
  
  // STEP 5: Look for links to individual games
  console.log('\n--- Step 5: Finding game links ---');
  const gameLinks = document.querySelectorAll('a[href*="wordle"]');
  console.log(`Found ${gameLinks.length} links containing "wordle"`);
  
  if (gameLinks.length > 0) {
    console.log('\nFirst 5 game links:');
    Array.from(gameLinks).slice(0, 5).forEach((link, idx) => {
      console.log(`  ${idx}: ${link.href}`);
      console.log(`     Text: ${link.textContent.trim()}`);
      console.log(`     Parent classes: ${link.parentElement?.className}`);
    });
  }
  
  // STEP 6: Find the "Show more" button
  console.log('\n--- Step 6: Finding Show More button ---');
  const allButtons = document.querySelectorAll('button, div[role="button"], [class*="show"], [class*="more"]');
  console.log(`Found ${allButtons.length} button-like elements`);
  
  allButtons.forEach((btn, idx) => {
    const text = btn.textContent.toLowerCase();
    if (text.includes('show') || text.includes('more') || text.includes('load')) {
      console.log(`\nButton ${idx}:`);
      console.log('  Tag:', btn.tagName);
      console.log('  Text:', btn.textContent.trim());
      console.log('  Classes:', btn.className);
      console.log('  Visible:', btn.offsetParent !== null);
    }
  });
  
  // STEP 7: Create a working extractor
  console.log('\n--- Step 7: Creating extractor based on findings ---');
  
  function extractGameFromElement(element) {
    const text = element.textContent;
    const game = {};
    
    // Extract solution
    const wordMatch = text.match(/\b([A-Z]{5})\b/);
    if (wordMatch) game.solution = wordMatch[1];
    
    // Extract date
    const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/);
    if (dateMatch) {
      game.dateString = `${dateMatch[1]} ${dateMatch[2]}`;
      
      // Convert to ISO date
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
    
    // Extract scores
    const skillMatch = text.match(/(?:SKILL|Skill)\s+(\d+)/i);
    if (skillMatch) game.skillScore = parseInt(skillMatch[1]);
    
    const luckMatch = text.match(/(?:LUCK|Luck)\s+(\d+)/i);
    if (luckMatch) game.luckScore = parseInt(luckMatch[1]);
    
    const stepsMatch = text.match(/(?:STEPS?|Steps?)\s+(\d+|X)/i);
    if (stepsMatch) {
      const val = stepsMatch[1];
      game.steps = val === 'X' ? 0 : parseInt(val);
      game.won = val !== 'X';
    }
    
    // Extract game number
    const gameNumMatch = text.match(/(?:Game|Wordle|#)\s*#?\s*(\d{3,4})/i);
    if (gameNumMatch) game.gameNumber = parseInt(gameNumMatch[1]);
    
    // Get link
    const link = element.querySelector('a[href*="wordle"]');
    if (link) {
      game.analysisUrl = link.href;
      
      // Try to extract game number from URL if not found
      if (!game.gameNumber) {
        const urlMatch = link.href.match(/wordle[/-](\d{3,4})/i);
        if (urlMatch) game.gameNumber = parseInt(urlMatch[1]);
      }
    }
    
    return game;
  }
  
  // Try to extract from what we found
  console.log('\n--- Extracting from potential cards ---');
  const extractedGames = potentialGameCards.map((card, idx) => {
    const game = extractGameFromElement(card);
    game.index = idx;
    return game;
  });
  
  console.log(`\nExtracted ${extractedGames.length} games:`);
  extractedGames.slice(0, 5).forEach(game => {
    console.log(`  ${game.solution} (${game.dateString}) - Skill: ${game.skillScore}, Luck: ${game.luckScore}, Steps: ${game.steps}`);
  });
  
  // STEP 8: Determine working selector
  console.log('\n--- Step 8: Determining best selector ---');
  
  let workingSelector = null;
  let workingElements = [];
  
  // If we found potential game cards, figure out what selector works
  if (potentialGameCards.length > 0) {
    const firstCard = potentialGameCards[0];
    const classes = Array.from(firstCard.classList);
    
    console.log('First card classes:', classes);
    
    // Try to build a selector from the classes
    for (const cls of classes) {
      const selector = `#g-wordle-results .${cls}`;
      const elements = Array.from(document.querySelectorAll(selector)).filter(el => {
        const text = el.textContent;
        return /\b[A-Z]{5}\b/.test(text) && /skill/i.test(text);
      });
      
      if (elements.length > 0) {
        console.log(`✓ Selector ".${cls}" finds ${elements.length} game elements`);
        if (elements.length > workingElements.length) {
          workingSelector = selector;
          workingElements = elements;
        }
      }
    }
  }
  
  console.log(`\nBest selector: "${workingSelector}"`);
  console.log(`Games found: ${workingElements.length}`);
  
  // STEP 9: Create extraction functions
  function extractAllGames() {
    if (!workingSelector) {
      console.error('No working selector found!');
      return [];
    }
    
    const elements = Array.from(document.querySelectorAll(workingSelector)).filter(el => {
      const text = el.textContent;
      return /\b[A-Z]{5}\b/.test(text) && /skill/i.test(text);
    });
    
    return elements.map(extractGameFromElement).filter(g => g.solution || g.gameNumber);
  }
  
  async function loadMoreGames() {
    // Find any button with "show more" text
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"], *'));
    const showMoreBtn = buttons.find(btn => 
      btn.textContent.toLowerCase().includes('show more') ||
      btn.textContent.toLowerCase().includes('load more')
    );
    
    if (!showMoreBtn || showMoreBtn.offsetParent === null) {
      console.log('❌ No more games to load');
      return false;
    }
    
    console.log('Clicking:', showMoreBtn.textContent.trim());
    showMoreBtn.click();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return true;
  }
  
  async function scrapeAllGames(maxIterations = 20) {
    console.log('\n🚀 Starting scrape...');
    
    const allGames = new Map();
    let iteration = 0;
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n--- Iteration ${iteration} ---`);
      
      const games = extractAllGames();
      console.log(`Found ${games.length} games on page`);
      
      games.forEach(game => {
        if (game.gameNumber) {
          allGames.set(game.gameNumber, game);
        }
      });
      
      console.log(`Total unique: ${allGames.size}`);
      
      const hasMore = await loadMoreGames();
      if (!hasMore) break;
    }
    
    const result = Array.from(allGames.values())
      .sort((a, b) => (b.gameNumber || 0) - (a.gameNumber || 0));
    
    console.log(`\n✅ Complete! ${result.length} games`);
    if (result.length > 0) {
      console.log(`   Range: ${result[result.length-1]?.dateString} to ${result[0]?.dateString}`);
    }
    
    return result;
  }
  
  // Export
  window.__WORDLE_EXTRACTOR_V4__ = {
    potentialGameCards,
    workingSelector,
    extractAllGames,
    loadMoreGames,
    scrapeAllGames,
    extractGameFromElement
  };
  
  console.log('\n✅ Debug analysis complete!');
  console.log('📦 Results: window.__WORDLE_EXTRACTOR_V4__');
  console.log('🎮 Extract: window.__WORDLE_EXTRACTOR_V4__.extractAllGames()');
  console.log('🚀 Scrape all: await window.__WORDLE_EXTRACTOR_V4__.scrapeAllGames()');
  
  return {
    potentialGameCards: potentialGameCards.length,
    workingSelector,
    extractedSample: extractedGames.slice(0, 3)
  };
})();
