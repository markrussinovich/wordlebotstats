/**
 * Wordle Bot Page Analyzer
 * 
 * This script should be run in the browser console on:
 * https://www.nytimes.com/interactive/2022/upshot/wordle-bot.html
 * 
 * Purpose: Analyze the page structure to understand how to scrape historical game data
 */

(function() {
  console.log('=== Wordle Bot Page Analysis ===');
  
  // 1. Find game cards/items on the page
  console.log('\n--- Looking for game cards ---');
  
  const selectors = [
    'div[data-testid*="game"]',
    'div[class*="game"]',
    'div[class*="score"]',
    'div[class*="history"]',
    'div[class*="result"]',
    'article',
    '.game-card',
    '.wordle-result',
    '[data-game]'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Found ${elements.length} elements with selector: ${selector}`);
      console.log('First element:', elements[0]);
    }
  });
  
  // 2. Find "Load More" or pagination buttons
  console.log('\n--- Looking for Load More buttons ---');
  
  const buttonSelectors = [
    'button',
    'a[class*="load"]',
    'button[class*="load"]',
    'button[class*="more"]',
    '[role="button"]'
  ];
  
  document.querySelectorAll('button').forEach(button => {
    const text = button.textContent.toLowerCase().trim();
    if (text.includes('load') || text.includes('more') || text.includes('show')) {
      console.log('Potential Load More button:', button);
      console.log('  Text:', button.textContent);
      console.log('  Class:', button.className);
      console.log('  ID:', button.id);
    }
  });
  
  // 3. Check for data attributes containing game info
  console.log('\n--- Checking for data attributes ---');
  
  // Walk through all elements to find data attributes
  const allElements = document.querySelectorAll('*');
  const dataAttributes = new Set();
  
  let elementCount = 0;
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        dataAttributes.add(attr.name);
        elementCount++;
      }
    });
  });
  
  console.log(`Found ${dataAttributes.size} unique data attributes on ${elementCount} elements:`, Array.from(dataAttributes));
  
  // 4. Look for game info in text content
  console.log('\n--- Looking for game information patterns ---');
  
  const bodyText = document.body.textContent;
  
  // Look for patterns like "GOOEY", "September 28", "Skill: 89", "Luck: 58", "Steps: 3"
  const wordPattern = /\b[A-Z]{5}\b/g;
  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/g;
  const skillPattern = /Skill[:\s]+(\d+)/gi;
  const luckPattern = /Luck[:\s]+(\d+)/gi;
  const stepsPattern = /Steps[:\s]+(\d+)/gi;
  
  const words = bodyText.match(wordPattern);
  const dates = bodyText.match(datePattern);
  const skills = bodyText.match(skillPattern);
  const lucks = bodyText.match(luckPattern);
  const steps = bodyText.match(stepsPattern);
  
  console.log('Found words:', words ? words.slice(0, 10) : 'none');
  console.log('Found dates:', dates ? dates.slice(0, 10) : 'none');
  console.log('Found skill scores:', skills ? skills.slice(0, 5) : 'none');
  console.log('Found luck scores:', lucks ? lucks.slice(0, 5) : 'none');
  console.log('Found steps:', steps ? steps.slice(0, 5) : 'none');
  
  // 5. Check network requests
  console.log('\n--- Network Request Analysis ---');
  console.log('Check the Network tab for:');
  console.log('- GraphQL queries (look for /graphql endpoints)');
  console.log('- REST API calls (look for /api/ endpoints)');
  console.log('- JSON responses containing game data');
  console.log('Suggested: Use Performance.getEntriesByType("resource") to see recent requests');
  
  const resources = performance.getEntriesByType('resource');
  const apiRequests = resources.filter(r => 
    r.name.includes('api') || 
    r.name.includes('graphql') || 
    r.name.includes('wordle') ||
    r.name.endsWith('.json')
  );
  
  console.log('Potential API requests:', apiRequests.map(r => r.name));
  
  // 6. Check for inline JSON/JavaScript data
  console.log('\n--- Looking for inline data ---');
  
  const scripts = document.querySelectorAll('script');
  scripts.forEach((script, index) => {
    const content = script.textContent;
    if (content.includes('wordle') || content.includes('game') || content.includes('score')) {
      console.log(`Script ${index} might contain game data (length: ${content.length})`);
      // Try to find JSON objects
      const jsonMatches = content.match(/\{[^{}]+(?:wordle|game|score)[^{}]+\}/gi);
      if (jsonMatches) {
        console.log('  Found potential JSON:', jsonMatches.slice(0, 2));
      }
    }
  });
  
  // 7. Check window/global variables
  console.log('\n--- Checking for global variables ---');
  
  const globalVars = ['__PRELOADED_STATE__', '__INITIAL_STATE__', 'gameData', 'wordleData', 'scores'];
  globalVars.forEach(varName => {
    if (window[varName]) {
      console.log(`Found global variable: ${varName}`);
      console.log('  Type:', typeof window[varName]);
      console.log('  Value preview:', JSON.stringify(window[varName]).slice(0, 200));
    }
  });
  
  // 8. Look for React/Vue/Angular component structures
  console.log('\n--- Looking for component structures ---');
  
  const reactRoots = document.querySelectorAll('[data-reactroot], [data-reactid], #root, #app');
  console.log('React-like roots:', reactRoots.length);
  
  // Check for __REACT_DEVTOOLS_GLOBAL_HOOK__
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('React DevTools detected - page likely uses React');
  }
  
  // 9. Create a sample game extractor function
  console.log('\n--- Creating sample extractor ---');
  
  function extractVisibleGames() {
    const games = [];
    
    // Try different strategies to find game data
    // Strategy 1: Look for structured elements
    const possibleGameContainers = document.querySelectorAll('div, article, section');
    
    possibleGameContainers.forEach(container => {
      const text = container.textContent;
      
      // Check if this element contains game information
      const hasWord = /\b[A-Z]{5}\b/.test(text);
      const hasDate = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/.test(text);
      const hasSkill = /Skill/.test(text);
      const hasLuck = /Luck/.test(text);
      
      if (hasWord && hasDate && hasSkill && hasLuck) {
        games.push({
          element: container,
          text: text.slice(0, 200),
          html: container.outerHTML.slice(0, 300)
        });
      }
    });
    
    return games;
  }
  
  const visibleGames = extractVisibleGames();
  console.log(`Found ${visibleGames.length} potential game containers`);
  if (visibleGames.length > 0) {
    console.log('First game sample:', visibleGames[0]);
  }
  
  // 10. Export analysis results
  console.log('\n--- Analysis Summary ---');
  
  const analysisResults = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    potentialGameCount: visibleGames.length,
    hasReact: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    apiRequests: apiRequests.map(r => r.name),
    recommendations: [
      'Inspect the actual page HTML to identify game card selectors',
      'Monitor Network tab when clicking "Load More" to see API calls',
      'Check for pagination state in URL or DOM',
      'Identify unique identifiers for each game (date, puzzle number)',
      'Test if games are rendered server-side or client-side'
    ]
  };
  
  console.log('Analysis complete:', analysisResults);
  
  // Make results available globally
  window.__WORDLE_BOT_ANALYSIS__ = analysisResults;
  window.__extractVisibleGames = extractVisibleGames;
  
  console.log('\n✅ Analysis complete! Results stored in window.__WORDLE_BOT_ANALYSIS__');
  console.log('📝 Run window.__extractVisibleGames() to try extracting games');
  
})();
