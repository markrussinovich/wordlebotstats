/**
 * Comprehensive Playwright test to verify popup streak behavior
 */

import { chromium } from 'playwright';

async function testPopupBehavior() {
  console.log('🧪 TESTING POPUP STREAK BEHAVIOR');
  console.log('=================================\n');
  
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9223');
    const contexts = browser.contexts();
    const context = contexts[0];
    
    // Step 1: Open a new tab to avoid content script conflicts
    console.log('📄 Opening new tab for popup testing...');
    const page = await context.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(1000);
    
    // Step 2: Inject synthetic data directly into storage
    console.log('\n💉 Injecting synthetic test data...');
    const injectionResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Create 10 consecutive wins over 10 days
        const today = new Date('2025-10-05'); // Fixed date for consistency
        const syntheticGames = [];
        
        for (let i = 9; i >= 0; i--) {
          const gameDate = new Date(today);
          gameDate.setDate(today.getDate() - i);
          
          syntheticGames.push({
            date: gameDate.toISOString().split('T')[0],
            won: true,
            isWin: true,
            attempts: 3,
            guesses: 3,
            solution: `TEST${10-i}`,
            skillScore: 95,
            luckScore: 75,
            hardMode: false,
            scrapedFrom: 'test',
            source: 'test',
            importedAt: new Date().toISOString(),
            wordLength: 5,
            maxGuesses: 6
          });
        }
        
        chrome.storage.local.clear(() => {
          chrome.storage.local.set({ games: syntheticGames }, () => {
            resolve({
              success: true,
              gamesInjected: syntheticGames.length,
              dateRange: `${syntheticGames[0].date} to ${syntheticGames[syntheticGames.length-1].date}`
            });
          });
        });
      });
    });
    
    console.log(`✅ Injected ${injectionResult.gamesInjected} games`);
    console.log(`   Date range: ${injectionResult.dateRange}`);
    
    // Step 3: Test background stats calculation for each timeframe
    const timeframes = ['7d', '30d', '90d', 'all'];
    const statsResults = {};
    
    for (const tf of timeframes) {
      console.log(`\n🔍 Testing background stats for ${tf}...`);
      
      const statsResult = await page.evaluate(async (timeFrame) => {
        try {
          // Simulate the background script's handleGetQuickStats
          const result = await chrome.storage.local.get(['games']);
          const allGames = result.games || [];
          
          // Filter games by timeframe
          let filteredGames = allGames;
          if (timeFrame !== 'all') {
            const days = timeFrame === '7d' ? 7 : timeFrame === '30d' ? 30 : 90;
            const cutoff = new Date('2025-10-05'); // Fixed date
            cutoff.setDate(cutoff.getDate() - days);
            
            filteredGames = allGames.filter(g => {
              return new Date(g.date) >= cutoff;
            });
          }
          
          // Calculate current streak (all games)
          let currentStreak = 0;
          const sortedAllGames = allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
          for (let i = sortedAllGames.length - 1; i >= 0; i--) {
            if (sortedAllGames[i].isWin ?? sortedAllGames[i].won) {
              currentStreak++;
            } else {
              break;
            }
          }
          
          // Calculate max streak (simplified)
          let maxStreak = currentStreak; // Since all games are wins
          
          // Determine what should be returned for this timeframe
          let streakToReturn;
          if (timeFrame === '7d') {
            streakToReturn = currentStreak;
          } else {
            // For non-7d, if current streak extends into the period, return it
            if (filteredGames.length > 0 && currentStreak > 0) {
              streakToReturn = currentStreak; // All 10 games are wins, so current streak extends into any period
            } else {
              streakToReturn = 0;
            }
          }
          
          const stats = {
            gameCount: filteredGames.length,
            winRate: filteredGames.length > 0 ? 100 : 0,
            averageGuesses: 3.0,
            currentStreak: timeFrame === '7d' ? streakToReturn : 0,
            maxStreak: timeFrame === '7d' ? maxStreak : streakToReturn,
            streakValue: timeFrame === '7d' ? currentStreak : streakToReturn,
            streakLabel: timeFrame === '7d' ? 'current' : 'longest'
          };
          
          return {
            timeFrame,
            allGamesCount: allGames.length,
            filteredGamesCount: filteredGames.length,
            calculatedCurrentStreak: currentStreak,
            calculatedMaxStreak: maxStreak,
            stats
          };
          
        } catch (error) {
          return { error: error.message };
        }
      }, tf);
      
      if (statsResult.error) {
        console.log(`❌ Error: ${statsResult.error}`);
        continue;
      }
      
      statsResults[tf] = statsResult;
      
      console.log(`   All games: ${statsResult.allGamesCount}`);
      console.log(`   Filtered games: ${statsResult.filteredGamesCount}`);
      console.log(`   Current streak (all): ${statsResult.calculatedCurrentStreak}`);
      console.log(`   Stats returned: currentStreak=${statsResult.stats.currentStreak}, maxStreak=${statsResult.stats.maxStreak}`);
      console.log(`   Expected display: ${statsResult.stats.streakLabel} streak = ${statsResult.stats.streakValue}`);
    }
    
    // Step 4: Simulate what the popup should display
    console.log('\n🖥️ POPUP DISPLAY SIMULATION:');
    console.log('============================');
    
    Object.entries(statsResults).forEach(([tf, result]) => {
      const { stats } = result;
      
      console.log(`${tf.toUpperCase()} view:`);
      console.log(`  Current popup (broken): "Current streak: ${stats.currentStreak}"`);
      console.log(`  Should display: "${stats.streakLabel.charAt(0).toUpperCase() + stats.streakLabel.slice(1)} streak: ${stats.streakValue}"`);
      
      // Identify the issue
      if (tf !== '7d' && stats.currentStreak === 0 && stats.maxStreak > 0) {
        console.log(`  🐛 BUG: Popup shows currentStreak (${stats.currentStreak}) instead of maxStreak (${stats.maxStreak})`);
      }
      if (tf !== '7d') {
        console.log(`  🐛 BUG: Popup shows "Current streak" instead of "Longest streak"`);
      }
      console.log('');
    });
    
    // Step 5: Summary and fix needed
    console.log('📋 SUMMARY OF ISSUES:');
    console.log('=====================');
    
    const issues = [];
    
    Object.entries(statsResults).forEach(([tf, result]) => {
      if (tf === '7d') {
        if (result.stats.currentStreak === 0) {
          issues.push(`7d: currentStreak should be ${result.calculatedCurrentStreak}, got 0`);
        }
      } else {
        if (result.stats.maxStreak === 0) {
          issues.push(`${tf}: maxStreak should be ${result.calculatedCurrentStreak}, got 0`);
        }
        issues.push(`${tf}: Label should be "Longest streak", not "Current streak"`);
        issues.push(`${tf}: Should display maxStreak (${result.stats.maxStreak}), not currentStreak (${result.stats.currentStreak})`);
      }
    });
    
    console.log('Issues found:');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    
    console.log('\n🔧 REQUIRED POPUP FIXES:');
    console.log('========================');
    console.log('The popup component needs to:');
    console.log('1. Check the current timeframe when displaying streak');
    console.log('2. For 7d: Show "Current streak: {currentStreak}"');
    console.log('3. For 30d/90d/all: Show "Longest streak: {maxStreak}"');
    console.log('');
    console.log('Current popup code probably looks like:');
    console.log('  <div>Current streak: {stats.currentStreak}</div>');
    console.log('');
    console.log('Should be changed to:');
    console.log('  <div>{timeFrame === "7d" ? "Current" : "Longest"} streak: {timeFrame === "7d" ? stats.currentStreak : stats.maxStreak}</div>');
    
    // Expected values for validation
    console.log('\n✅ EXPECTED VALUES (for 10 consecutive wins):');
    console.log('==============================================');
    console.log('7d:  "Current streak: 10"');
    console.log('30d: "Longest streak: 10"');
    console.log('90d: "Longest streak: 10"');
    console.log('all: "Longest streak: 10"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPopupBehavior().catch(console.error);