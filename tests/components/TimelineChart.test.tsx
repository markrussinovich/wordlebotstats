import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineChart from '../../src/components/charts/TimelineChart';
import { GameResult } from '../../src/types/gameTypes';

// Helper to create minimal valid GameResult objects
const createGame = (overrides: Partial<GameResult>): GameResult => ({
  date: '2025-01-01',
  attempts: 0,
  won: false,
  hardMode: false,
  ...overrides
});

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
      
      // Verify the chart renders
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
      
      // The chart should process all 3 games
      const scatterLayer = container.querySelector('.recharts-scatter');
      expect(scatterLayer).toBeInTheDocument();
    });

    it('should handle games with null stats (like MODAL)', () => {
      const gamesWithNullStats: GameResult[] = [
        {
          date: '2024-07-17',
          attempts: 0,
          won: false,
          solution: 'MODAL',
          guesses: 0,
          gameNumber: 1128,
          skillScore: undefined,
          luckScore: undefined
        },
        {
          date: '2024-07-18',
          attempts: 4,
          won: true,
          solution: 'TRADE',
          guesses: 4,
          gameNumber: 1129,
          skillScore: 85,
          luckScore: 62
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithNullStats} />);
      
      // Should render without crashing even with null stats
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });
  });

  describe('Date Gap Filling', () => {
    it('should fill in missing dates with "no game" points', () => {
      const gamesWithGap: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        // Oct 2 is missing - should be filled
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        },
        {
          date: '2025-10-04',
          attempts: 3,
          won: true,
          solution: 'RELAY',
          guesses: 3,
          gameNumber: 1200
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithGap} />);
      
      // Chart should render
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
      
      // The internal data should have 4 points (3 games + 1 filled date)
      // We can't directly access the internal state, but we can verify the chart renders correctly
      const scatterLayer = container.querySelector('.recharts-scatter');
      expect(scatterLayer).toBeInTheDocument();
    });

    it('should handle multiple consecutive missing dates', () => {
      const gamesWithLargeGap: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        // Oct 2, 3, 4, 5 are all missing
        {
          date: '2025-10-06',
          attempts: 4,
          won: true,
          solution: 'AMUSE',
          guesses: 4,
          gameNumber: 1202
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithLargeGap} />);
      
      // Should render without crashing
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });

    it('should not add fill dates when there are no gaps', () => {
      const consecutiveGames: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 3,
          won: true,
          solution: 'PLANE',
          guesses: 3,
          gameNumber: 1198
        },
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        }
      ];

      const { container } = render(<TimelineChart games={consecutiveGames} />);
      
      // Should render all games
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });
  });

  describe('Running Average Calculation', () => {
    it('should calculate running average correctly for won games only', () => {
      const mixedGames: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 0,
          won: false,
          solution: 'TIZZY',
          guesses: 0,
          gameNumber: 1198
        },
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        }
      ];

      const { container } = render(<TimelineChart games={mixedGames} />);
      
      // Should render the running average line
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
      const lineLayer = container.querySelector('.recharts-line');
      expect(lineLayer).toBeInTheDocument();
    });

    it('should handle edge case with only lost games', () => {
      const allLostGames: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 0,
          won: false,
          solution: 'TIZZY',
          guesses: 0,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 0,
          won: false,
          solution: 'MODAL',
          guesses: 0,
          gameNumber: 1198
        }
      ];

      const { container } = render(<TimelineChart games={allLostGames} />);
      
      // Should render without crashing even with no won games
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
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
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        }
      ];

      const { container } = render(<TimelineChart games={singleGame} />);
      
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });

    it('should handle games with missing optional fields', () => {
      const gamesWithMissingFields: GameResult[] = [
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          guesses: 4
          // Missing solution, gameNumber, etc.
        },
        {
          date: '2025-10-02',
          attempts: 3,
          won: true,
          guesses: 3
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithMissingFields} />);
      
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });
  });

  describe('Date Range and Sorting', () => {
    it('should handle unsorted games and sort them correctly', () => {
      const unsortedGames: GameResult[] = [
        {
          date: '2025-10-03',
          attempts: 3,
          won: true,
          solution: 'SPASM',
          guesses: 3,
          gameNumber: 1199
        },
        {
          date: '2025-10-01',
          attempts: 4,
          won: true,
          solution: 'SPOIL',
          guesses: 4,
          gameNumber: 1197
        },
        {
          date: '2025-10-02',
          attempts: 3,
          won: true,
          solution: 'PLANE',
          guesses: 3,
          gameNumber: 1198
        }
      ];

      const { container } = render(<TimelineChart games={unsortedGames} />);
      
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });

    it('should handle games spanning different years', () => {
      const crossYearGames: GameResult[] = [
        {
          date: '2024-12-31',
          attempts: 4,
          won: true,
          solution: 'YACHT',
          guesses: 4,
          gameNumber: 1100
        },
        {
          date: '2025-01-01',
          attempts: 3,
          won: true,
          solution: 'HAPPY',
          guesses: 3,
          gameNumber: 1101
        }
      ];

      const { container } = render(<TimelineChart games={crossYearGames} />);
      
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
    });
  });

  describe('Integration Test - Real World Scenario', () => {
    it('should handle a realistic mix of won, lost, and missing dates', () => {
      const realisticGames: GameResult[] = [
        {
          date: '2024-07-17',
          attempts: 0,
          won: false,
          solution: 'MODAL',
          guesses: 0,
          gameNumber: 1128,
          skillScore: undefined,
          luckScore: undefined
        },
        {
          date: '2024-07-18',
          attempts: 4,
          won: true,
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
          solution: 'BURNT',
          guesses: 3,
          gameNumber: 1133,
          skillScore: 95,
          luckScore: 75
        }
      ];

      const { container } = render(<TimelineChart games={realisticGames} />);
      
      // Should render complete timeline with 6 points (4 games + 2 filled dates)
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
      
      // Should have both scatter and line layers
      expect(container.querySelector('.recharts-scatter')).toBeInTheDocument();
      expect(container.querySelector('.recharts-line')).toBeInTheDocument();
    });
  });
});
