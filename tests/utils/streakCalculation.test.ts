import {
  calculateStreakStats,
  isGameWon,
  isGameLost,
  isGameUnplayed,
  filterPlayedGames,
  categorizeGames
} from '@/utils/streakCalculation';
import { GameResult } from '@/types/gameTypes';

describe('streakCalculation', () => {
  describe('isGameWon', () => {
    it('should return true for won games with 1-6 attempts', () => {
      expect(isGameWon({ won: true, attempts: 1 } as GameResult)).toBe(true);
      expect(isGameWon({ won: true, attempts: 3 } as GameResult)).toBe(true);
      expect(isGameWon({ won: true, attempts: 6 } as GameResult)).toBe(true);
    });

    it('should return false for games marked as not won', () => {
      expect(isGameWon({ won: false, attempts: 3 } as GameResult)).toBe(false);
      expect(isGameWon({ won: false, attempts: 7 } as GameResult)).toBe(false);
    });

    it('should return false for games with 0 attempts', () => {
      expect(isGameWon({ won: true, attempts: 0 } as GameResult)).toBe(false);
    });

    it('should return false for games with null attempts', () => {
      expect(isGameWon({ won: true, attempts: null } as GameResult)).toBe(false);
    });

    it('should return false for games with 7+ attempts', () => {
      expect(isGameWon({ won: true, attempts: 7 } as GameResult)).toBe(false);
      expect(isGameWon({ won: true, attempts: 10 } as GameResult)).toBe(false);
    });
  });

  describe('isGameLost', () => {
    it('should return true for games explicitly marked as lost', () => {
      expect(isGameLost({ won: false, attempts: 3 } as GameResult)).toBe(true);
      expect(isGameLost({ won: false, attempts: 6 } as GameResult)).toBe(true);
    });

    it('should return true for games with 7+ attempts', () => {
      expect(isGameLost({ won: false, attempts: 7 } as GameResult)).toBe(true);
      expect(isGameLost({ won: true, attempts: 7 } as GameResult)).toBe(true); // Failsafe
    });

    it('should return false for won games with valid attempts', () => {
      expect(isGameLost({ won: true, attempts: 3 } as GameResult)).toBe(false);
      expect(isGameLost({ won: true, attempts: 6 } as GameResult)).toBe(false);
    });
  });

  describe('isGameUnplayed', () => {
    it('should return true for games with 0 attempts', () => {
      expect(isGameUnplayed({ attempts: 0 } as GameResult)).toBe(true);
    });

    it('should return true for games with null attempts', () => {
      expect(isGameUnplayed({ attempts: null } as GameResult)).toBe(true);
    });

    it('should return true for games with undefined attempts', () => {
      expect(isGameUnplayed({} as GameResult)).toBe(true);
    });

    it('should return false for games with any attempts', () => {
      expect(isGameUnplayed({ attempts: 1 } as GameResult)).toBe(false);
      expect(isGameUnplayed({ attempts: 6 } as GameResult)).toBe(false);
    });
  });

  describe('filterPlayedGames', () => {
    it('should filter out unplayed games', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: false, attempts: 0 } as GameResult,
        { date: '2024-01-03', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-04', attempts: null } as GameResult,
      ];

      const filtered = filterPlayedGames(games);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].date).toBe('2024-01-01');
      expect(filtered[1].date).toBe('2024-01-03');
    });

    it('should return empty array for all unplayed games', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', attempts: 0 } as GameResult,
        { date: '2024-01-02', attempts: null } as GameResult,
      ];

      expect(filterPlayedGames(games)).toHaveLength(0);
    });
  });

  describe('categorizeGames', () => {
    it('should correctly categorize games into won, lost, and unplayed', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: false, attempts: 7 } as GameResult,
        { date: '2024-01-03', attempts: 0 } as GameResult,
        { date: '2024-01-04', won: true, attempts: 2 } as GameResult,
        { date: '2024-01-05', won: false, attempts: 6 } as GameResult,
      ];

      const result = categorizeGames(games);
      
      expect(result.won).toHaveLength(2);
      expect(result.won[0].date).toBe('2024-01-01');
      expect(result.won[1].date).toBe('2024-01-04');
      
      expect(result.lost).toHaveLength(2);
      expect(result.lost[0].date).toBe('2024-01-02');
      expect(result.lost[1].date).toBe('2024-01-05');
      
      expect(result.unplayed).toHaveLength(1);
      expect(result.unplayed[0].date).toBe('2024-01-03');
    });
  });

  describe('calculateStreakStats', () => {
    it('should return zero streaks for empty games', () => {
      const result = calculateStreakStats([], new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result.currentStreak).toBe(0);
      expect(result.maxStreak).toBe(0);
    });

    it('should return zero streaks for only unplayed games', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', attempts: 0 } as GameResult,
        { date: '2024-01-02', attempts: 0 } as GameResult,
      ];
      
      const result = calculateStreakStats(games, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result.currentStreak).toBe(0);
      expect(result.maxStreak).toBe(0);
    });

    it('should calculate current streak correctly for continuous wins', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-03', won: true, attempts: 2 } as GameResult,
      ];
      
      const result = calculateStreakStats(games, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result.currentStreak).toBe(3);
      expect(result.maxStreak).toBe(3);
    });

    it('should reset current streak after a loss', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-03', won: false, attempts: 7 } as GameResult,
        { date: '2024-01-04', won: true, attempts: 2 } as GameResult,
      ];
      
      const result = calculateStreakStats(games, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result.currentStreak).toBe(1); // Only the last win
      expect(result.maxStreak).toBe(2); // First two wins
    });

    it('should calculate max streak correctly across multiple streaks', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-03', won: false, attempts: 7 } as GameResult,
        { date: '2024-01-04', won: true, attempts: 2 } as GameResult,
        { date: '2024-01-05', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-06', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-07', won: true, attempts: 5 } as GameResult,
      ];
      
      const result = calculateStreakStats(games, new Date('2024-01-01'), new Date('2024-01-31'));
      expect(result.currentStreak).toBe(4); // Last 4 wins
      expect(result.maxStreak).toBe(4); // Best streak is the current one
    });

    it('EDGE CASE: should look back past start date to detect streak that extends into range', () => {
      const games: GameResult[] = [
        // Wins before the date range
        { date: '2023-12-28', won: true, attempts: 3 } as GameResult,
        { date: '2023-12-29', won: true, attempts: 4 } as GameResult,
        { date: '2023-12-30', won: true, attempts: 2 } as GameResult,
        { date: '2023-12-31', won: true, attempts: 3 } as GameResult,
        // Wins within the date range (continuing the streak)
        { date: '2024-01-01', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 2 } as GameResult,
        { date: '2024-01-03', won: true, attempts: 3 } as GameResult,
      ];
      
      // Date range starts at 2024-01-01, but streak started on 2023-12-28
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-31')
      );
      
      // Current streak should be 7 (includes games before start date)
      expect(result.currentStreak).toBe(7);
      expect(result.maxStreak).toBe(7);
    });

    it('EDGE CASE: should only count games up to endDate', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-03', won: true, attempts: 2 } as GameResult,
        // Games after endDate (should be ignored)
        { date: '2024-02-01', won: false, attempts: 7 } as GameResult,
        { date: '2024-02-02', won: true, attempts: 3 } as GameResult,
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-31')
      );
      
      // Should only count the 3 wins in January (ignoring February games)
      expect(result.currentStreak).toBe(3);
      expect(result.maxStreak).toBe(3);
    });

    it('EDGE CASE: should handle streak broken before range but new streak in range', () => {
      const games: GameResult[] = [
        // Old streak before range
        { date: '2023-12-28', won: true, attempts: 3 } as GameResult,
        { date: '2023-12-29', won: true, attempts: 4 } as GameResult,
        { date: '2023-12-30', won: false, attempts: 7 } as GameResult, // Breaks streak
        { date: '2023-12-31', won: true, attempts: 3 } as GameResult,
        // New streak within range
        { date: '2024-01-01', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 2 } as GameResult,
        { date: '2024-01-03', won: true, attempts: 3 } as GameResult,
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-31')
      );
      
      // Current streak should be 4 (Dec 31 + Jan 1-3)
      expect(result.currentStreak).toBe(4);
      // Max streak should still be 4 (since the old streak was only 2)
      expect(result.maxStreak).toBe(4);
    });

    it('EDGE CASE: should handle loss at end date breaking current streak', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-03', won: false, attempts: 7 } as GameResult, // Loss at end
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-03')
      );
      
      // Current streak is 0 (ended with a loss)
      expect(result.currentStreak).toBe(0);
      // Max streak is 2 (the wins before the loss)
      expect(result.maxStreak).toBe(2);
    });

    it('EDGE CASE: should handle alternating wins and losses', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: false, attempts: 7 } as GameResult,
        { date: '2024-01-03', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-04', won: false, attempts: 7 } as GameResult,
        { date: '2024-01-05', won: true, attempts: 2 } as GameResult,
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-31')
      );
      
      // Current streak is 1 (only the last game)
      expect(result.currentStreak).toBe(1);
      // Max streak is also 1 (never more than one in a row)
      expect(result.maxStreak).toBe(1);
    });

    it('EDGE CASE: should ignore unplayed games in streak calculation', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', attempts: 0 } as GameResult, // Unplayed
        { date: '2024-01-03', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-04', won: true, attempts: 2 } as GameResult,
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-31')
      );
      
      // Unplayed games should be ignored, so streak continues
      expect(result.currentStreak).toBe(3); // All three played games
      expect(result.maxStreak).toBe(3);
    });

    it('EDGE CASE: should handle the TIZZY bug case (won:false with 6 attempts)', () => {
      const games: GameResult[] = [
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-02', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-03', won: false, attempts: 6 } as GameResult, // TIZZY bug
        { date: '2024-01-04', won: true, attempts: 2 } as GameResult,
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-01'), 
        new Date('2024-01-31')
      );
      
      // won:false should be treated as a loss (breaking the streak)
      expect(result.currentStreak).toBe(1); // Only last game
      expect(result.maxStreak).toBe(2); // First two games
    });

    it('EDGE CASE: should work with date range in middle of data', () => {
      const games: GameResult[] = [
        // Before range
        { date: '2024-01-01', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-05', won: true, attempts: 4 } as GameResult,
        { date: '2024-01-10', won: false, attempts: 7 } as GameResult,
        // Within range
        { date: '2024-01-15', won: true, attempts: 2 } as GameResult,
        { date: '2024-01-20', won: true, attempts: 3 } as GameResult,
        { date: '2024-01-25', won: true, attempts: 4 } as GameResult,
        // After range
        { date: '2024-02-01', won: false, attempts: 7 } as GameResult,
        { date: '2024-02-05', won: true, attempts: 3 } as GameResult,
      ];
      
      const result = calculateStreakStats(
        games, 
        new Date('2024-01-15'), 
        new Date('2024-01-31')
      );
      
      // Current streak at end of range (Jan 31) is 3
      expect(result.currentStreak).toBe(3);
      expect(result.maxStreak).toBe(3);
    });
  });
});
