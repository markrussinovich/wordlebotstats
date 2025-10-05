/**
 * Test streak calculation logic with mock data
 */

function testStreakCalculation() {
  console.log('🧪 TESTING STREAK CALCULATION LOGIC');
  console.log('====================================\n');

  // Mock 10 consecutive wins over 10 days (simulating the 94-game scenario)
  const mockGames = [];
  const today = new Date();
  
  for (let i = 9; i >= 0; i--) {
    const gameDate = new Date(today);
    gameDate.setDate(today.getDate() - i);
    
    mockGames.push({
      date: gameDate.toISOString().split('T')[0],
      isWin: true,
      won: true,
      solution: `GAME${10-i}`,
      guesses: 3 + (i % 3)
    });
  }
  
  console.log('📊 Mock data created:');
  console.log(`  Total games: ${mockGames.length}`);
  console.log(`  Date range: ${mockGames[0].date} to ${mockGames[mockGames.length-1].date}`);
  console.log(`  All wins: ${mockGames.every(g => g.isWin)}`);
  
  // Test the streak calculation logic
  function calculateStreakForTimeFrame(timeFrame) {
    const sortedAllGames = mockGames.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate current streak (from most recent game backwards)
    let currentStreak = 0;
    for (let i = sortedAllGames.length - 1; i >= 0; i--) {
      const isWin = sortedAllGames[i].isWin ?? sortedAllGames[i].won;
      if (isWin) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    console.log(`\n🔍 Testing timeFrame: ${timeFrame}`);
    console.log(`  Current streak (all games): ${currentStreak}`);
    
    if (timeFrame === '7d') {
      return { type: 'current', value: currentStreak };
    }
    
    // For other periods, find longest streak that ends within the period
    const now = new Date();
    let cutoffDate;
    switch (timeFrame) {
      case '30d':
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default: // 'all'
        cutoffDate = new Date(0);
        break;
    }
    
    console.log(`  Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`);
    
    // Get games within the period
    const periodGames = sortedAllGames.filter(game => {
      if (!game.date) return false;
      const gameDate = new Date(game.date);
      return gameDate >= cutoffDate;
    });
    
    console.log(`  Games in period: ${periodGames.length}`);
    console.log(`  Period range: ${periodGames[0]?.date} to ${periodGames[periodGames.length-1]?.date}`);
    
    if (periodGames.length === 0) return { type: 'longest', value: 0 };
    
    let maxStreakLength = 0;
    
    // For each game in the period, check if it's the end of a streak
    for (let i = 0; i < periodGames.length; i++) {
      const gameDate = new Date(periodGames[i].date);
      const isWin = periodGames[i].isWin ?? periodGames[i].won;
      
      console.log(`    Checking game ${i}: ${periodGames[i].date}, win: ${isWin}`);
      
      if (!isWin) continue;
      
      // Count backward from this game to find the full streak length
      let streakLength = 0;
      
      // Find this game in the full sorted list
      for (let j = sortedAllGames.length - 1; j >= 0; j--) {
        const allGameDate = new Date(sortedAllGames[j].date);
        
        if (allGameDate.getTime() === gameDate.getTime()) {
          // Found the current game, start counting backward
          let k = j;
          while (k >= 0) {
            const backGameIsWin = sortedAllGames[k].isWin ?? sortedAllGames[k].won;
            if (backGameIsWin) {
              streakLength++;
              k--;
            } else {
              break;
            }
          }
          break;
        }
      }
      
      console.log(`      Streak length ending at ${periodGames[i].date}: ${streakLength}`);
      maxStreakLength = Math.max(maxStreakLength, streakLength);
    }
    
    console.log(`  Max streak found: ${maxStreakLength}`);
    return { type: 'longest', value: maxStreakLength };
  }
  
  // Test all timeframes
  const timeFrames = ['7d', '30d', '90d', 'all'];
  const results = {};
  
  timeFrames.forEach(tf => {
    results[tf] = calculateStreakForTimeFrame(tf);
  });
  
  console.log('\n📈 FINAL RESULTS:');
  console.log('=================');
  Object.entries(results).forEach(([tf, result]) => {
    console.log(`${tf.padEnd(4)}: ${result.type} streak = ${result.value}`);
  });
  
  console.log('\n🎯 EXPECTED vs ACTUAL:');
  console.log('======================');
  console.log('Expected for 10 consecutive wins:');
  console.log('  7d:  current streak = 7 (if 7+ games in last 7 days)');
  console.log('  30d: longest streak = 10 (all games are within 30 days)');
  console.log('  90d: longest streak = 10 (all games are within 90 days)');
  console.log('  all: longest streak = 10 (all games ever)');
  
  // Validation
  const issues = [];
  if (results['7d'].value === 0) issues.push('7d current streak should not be 0');
  if (results['30d'].value === 0) issues.push('30d longest streak should not be 0');
  if (results['90d'].value === 0) issues.push('90d longest streak should not be 0');
  if (results['all'].value === 0) issues.push('all-time longest streak should not be 0');
  
  if (issues.length > 0) {
    console.log('\n❌ ISSUES FOUND:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\n✅ All streak calculations working correctly!');
  }
}

testStreakCalculation();