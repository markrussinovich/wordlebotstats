import { GameResult } from '@/types/gameTypes';

/**
 * Calculate streak statistics for a set of games within a date range.
 * 
 * This function looks at all games up to endDate to calculate streaks,
 * but filters statistics to only games within the date range.
 * This allows the logic to look back past the start date to see if a win
 * within the range is part of a streak that extends prior to the start.
 * 
 * @param allGames - Complete set of games (used for streak lookback)
 * @param startDate - Start of the date range to analyze (for filtering stats)
 * @param endDate - End of the date range to analyze (usually current date or right edge of zoom)
 * @returns Object with currentStreak and maxStreak
 */
export function calculateStreakStats(
  allGames: GameResult[],
  startDate: Date,
  endDate: Date
): { currentStreak: number; maxStreak: number } {
  // Filter to only played games (exclude 0 attempts/unplayed)
  const playedGames = allGames.filter(g => g.attempts && g.attempts > 0);
  
  if (playedGames.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }
  
  // Sort games chronologically (oldest to newest)
  const sortedGames = [...playedGames].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Filter games up to endDate for streak calculation
  const gamesUpToEnd = sortedGames.filter(g => new Date(g.date) <= endDate);
  
  if (gamesUpToEnd.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }
  
  // Calculate current streak: work backwards from endDate
  let currentStreak = 0;
  for (let i = gamesUpToEnd.length - 1; i >= 0; i--) {
    const game = gamesUpToEnd[i];
    if (!game) continue;
    
    // Win = won field is true (regardless of attempts)
    // Loss = won field is false (regardless of attempts)
    if (game.won) {
      currentStreak++;
    } else {
      break; // Stop at first loss
    }
  }
  
  // Calculate max streak: forward through all games up to endDate
  let maxStreak = 0;
  let tempStreak = 0;
  
  for (const game of gamesUpToEnd) {
    if (game.won) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  console.log('[StreakCalculation]', {
    allGamesCount: allGames.length,
    playedGamesCount: playedGames.length,
    gamesUpToEndCount: gamesUpToEnd.length,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    currentStreak,
    maxStreak
  });
  
  return { currentStreak, maxStreak };
}

/**
 * Check if a game is a win based on the won field.
 * This is the canonical definition used across the app.
 * 
 * @param game - Game result to check
 * @returns true if the game is a win (won=true and attempts 1-6)
 */
export function isGameWon(game: GameResult): boolean {
  return game.won === true && 
         game.attempts !== null && 
         game.attempts >= 1 && 
         game.attempts <= 6;
}

/**
 * Check if a game is a loss based on the won field.
 * This is the canonical definition used across the app.
 * 
 * @param game - Game result to check
 * @returns true if the game is a loss (won=false or attempts=7+)
 */
export function isGameLost(game: GameResult): boolean {
  // Loss if explicitly marked as not won
  if (game.won === false) {
    return true;
  }
  // Also loss if 7+ attempts (failsafe)
  if (game.attempts !== null && game.attempts >= 7) {
    return true;
  }
  return false;
}

/**
 * Check if a game is unplayed.
 * 
 * @param game - Game result to check
 * @returns true if the game is unplayed (0 attempts)
 */
export function isGameUnplayed(game: GameResult): boolean {
  return !game.attempts || game.attempts === 0;
}

/**
 * Filter games to only include played games (exclude unplayed/0 attempts).
 * 
 * @param games - Array of game results
 * @returns Filtered array of only played games
 */
export function filterPlayedGames(games: GameResult[]): GameResult[] {
  return games.filter(g => !isGameUnplayed(g));
}

/**
 * Categorize games into wins, losses, and unplayed.
 * 
 * @param games - Array of game results
 * @returns Object with arrays of won, lost, and unplayed games
 */
export function categorizeGames(games: GameResult[]): {
  won: GameResult[];
  lost: GameResult[];
  unplayed: GameResult[];
} {
  const won: GameResult[] = [];
  const lost: GameResult[] = [];
  const unplayed: GameResult[] = [];
  
  for (const game of games) {
    if (isGameUnplayed(game)) {
      unplayed.push(game);
    } else if (isGameWon(game)) {
      won.push(game);
    } else if (isGameLost(game)) {
      lost.push(game);
    }
  }
  
  return { won, lost, unplayed };
}
