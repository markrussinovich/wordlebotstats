// Test script to run in browser console on WordleBot page
// Copy and paste this into the console while on the game history page

(function() {
  console.log('=== WordleBot Scraper Test ===\n');
  
  // Find all game cards
  const cards = document.querySelectorAll('.rating-container.svelte-pnoxcy');
  console.log(`Found ${cards.length} game cards\n`);
  
  if (cards.length === 0) {
    console.error('❌ No game cards found! Make sure you are on the game history page.');
    return;
  }
  
  // Test extraction on first 20 games (to find July 21 lost game)
  const results = [];
  
  cards.forEach((card, index) => {
    if (index < 60 || index > 80) return; // Test first 20
    
    console.log(`\n=== Testing Card ${index + 1} ===`);
    
    // Extract solution
    const solutionEl = card.querySelector('strong.solution');
    const solution = solutionEl ? solutionEl.textContent.trim().toUpperCase() : null;
    console.log(`Solution element found: ${!!solutionEl}`);
    console.log(`Solution: ${solution}`);
    
    // Extract date
    const dateEl = card.querySelector('span.date-label');
    const dateText = dateEl ? dateEl.textContent.trim() : null;
    console.log(`Date element found: ${!!dateEl}`);
    console.log(`Date: ${dateText}`);
    
    // Extract rating-right
    const ratingRight = card.querySelector('.rating-right');
    console.log(`Rating-right found: ${!!ratingRight}`);
    
    if (ratingRight) {
      const numValues = ratingRight.querySelectorAll('.rating-value.num span.num');
      console.log(`Found ${numValues.length} numeric values`);
      
      const skill = numValues[0] ? numValues[0].textContent.trim() : null;
      const luck = numValues[1] ? numValues[1].textContent.trim() : null;
      const steps = numValues[2] ? numValues[2].textContent.trim() : null;
      
      console.log(`Skill: ${skill}`);
      console.log(`Luck: ${luck}`);
      console.log(`Steps: ${steps}`);
      
      const isLost = steps === '-' || steps === '—' || steps === '–';
      console.log(`Is Lost Game: ${isLost}`);
      
      results.push({
        index: index + 1,
        solution,
        date: dateText,
        skill: skill ? parseInt(skill) : null,
        luck: luck ? parseInt(luck) : null,
        steps: isLost ? 'LOST' : (steps ? parseInt(steps) : null),
        won: !isLost && steps !== null
      });
      
      // Validation
      const checks = [
        { pass: !!solution, msg: 'Has solution' },
        { pass: solution && solution.length === 5, msg: 'Solution is 5 letters' },
        { pass: !!dateText, msg: 'Has date' },
        { pass: !!skill, msg: 'Has skill score' },
        { pass: !!luck, msg: 'Has luck score' },
        { pass: steps !== null, msg: 'Has steps value (or dash)' }
      ];
      
      const allPassed = checks.every(c => c.pass);
      console.log(allPassed ? '✓ All checks passed' : '✗ Some checks failed');
      checks.forEach(c => {
        console.log(`  ${c.pass ? '✓' : '✗'} ${c.msg}`);
      });
    } else {
      console.error('❌ Could not find rating-right section!');
    }
  });
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.table(results);
  
  // Check for date-word mismatches
  console.log('\n=== Checking for Date-Word Associations ===');
  const dateWordMap = new Map();
  let hasMismatch = false;
  
  results.forEach((game, index) => {
    if (game.date && game.solution) {
      if (dateWordMap.has(game.date)) {
        const existing = dateWordMap.get(game.date);
        if (existing !== game.solution) {
          console.error(`❌ MISMATCH FOUND!`);
          console.error(`   Date "${game.date}" maps to both "${existing}" and "${game.solution}"`);
          hasMismatch = true;
        }
      } else {
        dateWordMap.set(game.date, game.solution);
      }
    }
  });
  
  if (!hasMismatch) {
    console.log('✓ No date-word mismatches found in tested games');
  }
  
  // Check for lost games
  const lostGames = results.filter(g => g.steps === 'LOST');
  if (lostGames.length > 0) {
    console.log(`\n✓ Found ${lostGames.length} lost game(s):`);
    lostGames.forEach(g => {
      console.log(`   ${g.date}: ${g.solution} (Skill: ${g.skill}, Luck: ${g.luck})`);
    });
  } else {
    console.log('\n⚠ No lost games found in the first 5 cards');
  }
  
  return results;
})();
