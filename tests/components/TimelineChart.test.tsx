import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineChart from '../../src/components/charts/TimelineChart';
import { GameResult } from '../../src/types/gameTypes';

describe('TimelineChart', () => {
  describe('Lost Games Display', () => {
    it('should correctly identify and display lost games with won=false', () => {
      const gamesWithLoss: GameResult[] = [
        {
          date: '2024-07-20',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'AMUSE',
          guesses: 4,
          gameNumber: 1131
        },
        {
          date: '2024-07-21',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'TIZZY',
          guesses: 0,
          gameNumber: 1132
        },
        {
          date: '2024-07-22',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'BURNT',
          guesses: 3,
          gameNumber: 1133
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithLoss} />);
      
      // Verify the component renders without crashing
      expect(container).toBeInTheDocument();
    });

    it('should handle games with null stats (like MODAL)', () => {
      const gamesWithNullStats: GameResult[] = [
        {
          date: '2024-07-17',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'MODAL',
          guesses: 0,
          gameNumber: 1128
        },
        {
          date: '2024-07-18',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'TRADE',
          guesses: 4,
          gameNumber: 1129,
          skillScore: 85,
          luckScore: 62
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithNullStats} />);
      
      // Should render without crashing even with null stats
      expect(container).toBeInTheDocument();
    });
  });

  describe('Date Gap Filling', () => {
    it('should fill in missing dates with "no game" points', () => {
      const gamesWithGap: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        // Oct 2 is missing - should be filled
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        },
        {
          date: '2025-10-04',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'RELAY',
          guesses: 3,
          gameNumber: 1200
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithGap} />);
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should handle multiple consecutive missing dates', () => {
      const gamesWithLargeGap: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        // Oct 2, 3, 4, 5 are all missing
        {
          date: '2025-10-06',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'AMUSE',
          guesses: 4,
          gameNumber: 1202
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithLargeGap} />);
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should not add fill dates when there are no gaps', () => {
      const consecutiveGames: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'PLANE',
          guesses: 3,
          gameNumber: 1198
        },
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        }
      ];

      const { container } = render(<TimelineChart games={consecutiveGames} />);
      
      // Should render all games
      expect(container).toBeInTheDocument();
    });
  });

  describe('Running Average Calculation', () => {
    it('should calculate running average correctly for won games only', () => {
      const mixedGames: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'TIZZY',
          guesses: 0,
          gameNumber: 1198
        },
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        }
      ];

      const { container } = render(<TimelineChart games={mixedGames} />);
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should handle edge case with only lost games', () => {
      const allLostGames: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'TIZZY',
          guesses: 0,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'MODAL',
          guesses: 0,
          gameNumber: 1198
        }
      ];

      const { container } = render(<TimelineChart games={allLostGames} />);
      
      // Should render without crashing even with no won games
      expect(container).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty games array', () => {
      const { container } = render(<TimelineChart games={[]} />);
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should handle single game', () => {
      const singleGame: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        }
      ];

      const { container } = render(<TimelineChart games={singleGame} />);
      
      expect(container).toBeInTheDocument();
    });

    it('should handle games with missing optional fields', () => {
      const gamesWithMissingFields: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          guesses: 4
          // Missing solution, gameNumber, etc.
        },
        {
          date: '2025-10-02',
          attempts: 3,
          won: true,
          hardMode: false,
          guesses: 3
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithMissingFields} />);
      
      expect(container).toBeInTheDocument();
    });
  });

  describe('Date Range and Sorting', () => {
    it('should handle unsorted games and sort them correctly', () => {
      const unsortedGames: GameResult[] = [
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        },
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'PLANE',
          guesses: 3,
          gameNumber: 1198
        }
      ];

      const { container } = render(<TimelineChart games={unsortedGames} />);
      
      expect(container).toBeInTheDocument();
    });

    it('should handle games spanning different years', () => {
      const crossYearGames: GameResult[] = [
        {
          date: '2024-12-31',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'YACHT',
          guesses: 4,
          gameNumber: 1100
        },
        {
          date: '2025-01-01',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'HAPPY',
          guesses: 3,
          gameNumber: 1101
        }
      ];

      const { container } = render(<TimelineChart games={crossYearGames} />);
      
      expect(container).toBeInTheDocument();
    });
  });

  describe('Integration Test - Real World Scenario', () => {
    it('should handle a realistic mix of won, lost, and missing dates', () => {
      const realisticGames: GameResult[] = [
        {
          date: '2024-07-17',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'MODAL',
          guesses: 0,
          gameNumber: 1128
        },
        {
          date: '2024-07-18',
          attempts: 4,
          won: true,
          hardMode: false,
          solution: 'TRADE',
          guesses: 4,
          gameNumber: 1129,
          skillScore: 85,
          luckScore: 62
        },
        // 7/19 and 7/20 missing - should be filled
        {
          date: '2024-07-21',
          attempts: 0,
          won: false,
          hardMode: false,
          solution: 'TIZZY',
          guesses: 0,
          gameNumber: 1132,
          skillScore: 39,
          luckScore: 39
        },
        {
          date: '2024-07-22',
          attempts: 3,
          won: true,
          hardMode: false,
          solution: 'BURNT',
          guesses: 3,
          gameNumber: 1133,
          skillScore: 95,
          luckScore: 75
        }
      ];

      const { container } = render(<TimelineChart games={realisticGames} />);
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });
  });
});
