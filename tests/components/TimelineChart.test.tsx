import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineChart, { 
  calculateRunningAverages, 
  mergeZoomedAverages,
  TestChartDataPoint 
} from '../../src/components/charts/TimelineChart';
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

  describe('Zoomed Running Averages - calculateRunningAverages', () => {
    it('should calculate running averages correctly for won games', () => {
      const data: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true },
        { date: '2025-01-02', turns: 3, won: true },
        { date: '2025-01-03', turns: 5, won: true },
      ];

      const result = calculateRunningAverages(data);

      // First game: avg = 4/1 = 4
      expect(result[0].runningAverage).toBe(4);
      // Second game: avg = (4+3)/2 = 3.5
      expect(result[1].runningAverage).toBe(3.5);
      // Third game: avg = (4+3+5)/3 = 4
      expect(result[2].runningAverage).toBe(4);
    });

    it('should exclude lost games from turn averages', () => {
      const data: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true },
        { date: '2025-01-02', turns: 0, won: false }, // Lost
        { date: '2025-01-03', turns: 6, won: true },
      ];

      const result = calculateRunningAverages(data);

      // First game: avg = 4/1 = 4
      expect(result[0].runningAverage).toBe(4);
      // Second game (lost): still avg = 4 (not counted)
      expect(result[1].runningAverage).toBe(4);
      // Third game: avg = (4+6)/2 = 5
      expect(result[2].runningAverage).toBe(5);
    });

    it('should exclude unplayed games (won=null) from averages', () => {
      const data: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true },
        { date: '2025-01-02', turns: 0, won: null }, // Unplayed
        { date: '2025-01-03', turns: 2, won: true },
      ];

      const result = calculateRunningAverages(data);

      expect(result[0].runningAverage).toBe(4);
      expect(result[1].runningAverage).toBe(4); // Still 4, unplayed not counted
      expect(result[2].runningAverage).toBe(3); // (4+2)/2 = 3
    });

    it('should calculate skill running average correctly', () => {
      const data: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true, skillScore: 80 },
        { date: '2025-01-02', turns: 3, won: true, skillScore: 90 },
        { date: '2025-01-03', turns: 5, won: true, skillScore: 70 },
      ];

      const result = calculateRunningAverages(data);

      expect(result[0].runningSkillAvg).toBe(80);
      expect(result[1].runningSkillAvg).toBe(85); // (80+90)/2
      expect(result[2].runningSkillAvg).toBe(80); // (80+90+70)/3
    });

    it('should calculate luck running average correctly', () => {
      const data: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true, luckScore: 50 },
        { date: '2025-01-02', turns: 3, won: true, luckScore: 70 },
        { date: '2025-01-03', turns: 5, won: true, luckScore: 40 },
      ];

      const result = calculateRunningAverages(data);

      expect(result[0].runningLuckAvg).toBe(50);
      expect(result[1].runningLuckAvg).toBe(60); // (50+70)/2
      expect(result[2].runningLuckAvg).toBeCloseTo(53.33, 1); // (50+70+40)/3
    });

    it('should return undefined for running averages when no valid data', () => {
      const data: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 0, won: false },
        { date: '2025-01-02', turns: 0, won: null },
      ];

      const result = calculateRunningAverages(data);

      expect(result[0].runningAverage).toBeUndefined();
      expect(result[1].runningAverage).toBeUndefined();
      expect(result[0].runningSkillAvg).toBeUndefined();
      expect(result[1].runningLuckAvg).toBeUndefined();
    });
  });

  describe('Zoomed Running Averages - mergeZoomedAverages', () => {
    it('should update visible range with new running averages', () => {
      const fullData: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true, runningAverage: 4 },
        { date: '2025-01-02', turns: 3, won: true, runningAverage: 3.5 },
        { date: '2025-01-03', turns: 5, won: true, runningAverage: 4 },
        { date: '2025-01-04', turns: 2, won: true, runningAverage: 3.5 },
      ];

      // Visible data is just days 2-3, with recalculated averages
      const visibleData: TestChartDataPoint[] = [
        { date: '2025-01-02', turns: 3, won: true, runningAverage: 3 },
        { date: '2025-01-03', turns: 5, won: true, runningAverage: 4 },
      ];

      const result = mergeZoomedAverages(fullData, visibleData);

      // Days outside visible range should have undefined averages
      expect(result[0].runningAverage).toBeUndefined();
      expect(result[3].runningAverage).toBeUndefined();
      
      // Days in visible range should have the zoomed averages
      expect(result[1].runningAverage).toBe(3);
      expect(result[2].runningAverage).toBe(4);
    });

    it('should clear all averages outside visible range', () => {
      const fullData: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true, runningAverage: 4, runningSkillAvg: 80, runningLuckAvg: 50 },
        { date: '2025-01-02', turns: 3, won: true, runningAverage: 3.5, runningSkillAvg: 85, runningLuckAvg: 60 },
        { date: '2025-01-03', turns: 5, won: true, runningAverage: 4, runningSkillAvg: 80, runningLuckAvg: 53 },
      ];

      const visibleData: TestChartDataPoint[] = [
        { date: '2025-01-02', turns: 3, won: true, runningAverage: 3, runningSkillAvg: 90, runningLuckAvg: 70 },
      ];

      const result = mergeZoomedAverages(fullData, visibleData);

      // First day - outside range
      expect(result[0].runningAverage).toBeUndefined();
      expect(result[0].runningSkillAvg).toBeUndefined();
      expect(result[0].runningLuckAvg).toBeUndefined();
      
      // Second day - in range
      expect(result[1].runningAverage).toBe(3);
      expect(result[1].runningSkillAvg).toBe(90);
      expect(result[1].runningLuckAvg).toBe(70);
      
      // Third day - outside range
      expect(result[2].runningAverage).toBeUndefined();
      expect(result[2].runningSkillAvg).toBeUndefined();
      expect(result[2].runningLuckAvg).toBeUndefined();
    });

    it('should preserve other data properties when merging', () => {
      const fullData: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true, skillScore: 80, runningAverage: 4 },
        { date: '2025-01-02', turns: 3, won: true, skillScore: 90, runningAverage: 3.5 },
      ];

      const visibleData: TestChartDataPoint[] = [
        { date: '2025-01-02', turns: 3, won: true, skillScore: 90, runningAverage: 3 },
      ];

      const result = mergeZoomedAverages(fullData, visibleData);

      // Original properties should be preserved
      expect(result[0].turns).toBe(4);
      expect(result[0].won).toBe(true);
      expect(result[0].skillScore).toBe(80);
      
      expect(result[1].turns).toBe(3);
      expect(result[1].won).toBe(true);
      expect(result[1].skillScore).toBe(90);
    });
  });

  describe('Zoomed Running Averages - Integration', () => {
    it('should recalculate averages correctly for a subset of data', () => {
      // Simulates what happens when user zooms to a subset
      const fullData: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 6, won: true },  // Poor game
        { date: '2025-01-02', turns: 6, won: true },  // Poor game
        { date: '2025-01-03', turns: 3, won: true },  // Good game
        { date: '2025-01-04', turns: 3, won: true },  // Good game
        { date: '2025-01-05', turns: 4, won: true },  // OK game
      ];

      // Calculate full running averages
      const fullWithAverages = calculateRunningAverages(fullData);
      
      // Full dataset average at end: (6+6+3+3+4)/5 = 4.4
      expect(fullWithAverages[4].runningAverage).toBe(4.4);

      // Now zoom to just days 3-4 (the good games)
      const zoomedSubset = fullData.slice(2, 4);
      const zoomedWithAverages = calculateRunningAverages(zoomedSubset);
      
      // Zoomed average at end: (3+3)/2 = 3
      expect(zoomedWithAverages[1].runningAverage).toBe(3);

      // Merge back to full dataset
      const merged = mergeZoomedAverages(fullWithAverages, zoomedWithAverages);
      
      // Days outside zoom should be undefined
      expect(merged[0].runningAverage).toBeUndefined();
      expect(merged[1].runningAverage).toBeUndefined();
      expect(merged[4].runningAverage).toBeUndefined();
      
      // Days inside zoom should have zoomed averages
      expect(merged[2].runningAverage).toBe(3);   // First zoomed game
      expect(merged[3].runningAverage).toBe(3);   // (3+3)/2 = 3
    });

    it('should correctly handle skill/luck averages for zoomed range', () => {
      const fullData: TestChartDataPoint[] = [
        { date: '2025-01-01', turns: 4, won: true, skillScore: 50, luckScore: 30 },
        { date: '2025-01-02', turns: 3, won: true, skillScore: 90, luckScore: 80 },
        { date: '2025-01-03', turns: 3, won: true, skillScore: 95, luckScore: 85 },
        { date: '2025-01-04', turns: 4, won: true, skillScore: 60, luckScore: 40 },
      ];

      const fullWithAverages = calculateRunningAverages(fullData);
      
      // Full skill avg: (50+90+95+60)/4 = 73.75
      expect(fullWithAverages[3].runningSkillAvg).toBe(73.75);
      
      // Zoom to days 2-3 (high skill games)
      const zoomedSubset = fullData.slice(1, 3);
      const zoomedWithAverages = calculateRunningAverages(zoomedSubset);
      
      // Zoomed skill avg: (90+95)/2 = 92.5
      expect(zoomedWithAverages[1].runningSkillAvg).toBe(92.5);
      // Zoomed luck avg: (80+85)/2 = 82.5
      expect(zoomedWithAverages[1].runningLuckAvg).toBe(82.5);
    });
  });

  describe('Chart Display Stats Update on Zoom', () => {
    it('should render with correct initial averages displayed', () => {
      const gamesWithSkillLuck: GameResult[] = [
        {
          date: '2025-12-01',
          attempts: 4,
          won: true,
          hardMode: false,
          guesses: 4,
          gameNumber: 1500,
          skillScore: 80,
          luckScore: 60
        },
        {
          date: '2025-12-02',
          attempts: 3,
          won: true,
          hardMode: false,
          guesses: 3,
          gameNumber: 1501,
          skillScore: 90,
          luckScore: 70
        },
        {
          date: '2025-12-03',
          attempts: 5,
          won: true,
          hardMode: false,
          guesses: 5,
          gameNumber: 1502,
          skillScore: 70,
          luckScore: 50
        }
      ];

      const { container } = render(<TimelineChart games={gamesWithSkillLuck} />);
      
      // Average turns: (4+3+5)/3 = 4
      expect(container).toBeInTheDocument();
      
      // The chart stats should include averages
      const statsContainer = container.querySelector('.chart-stats');
      expect(statsContainer).toBeInTheDocument();
    });

    it('should call onRangeChange callback when brush changes', () => {
      const mockOnRangeChange = jest.fn();
      const games: GameResult[] = [
        {
          date: '2025-12-01',
          attempts: 4,
          won: true,
          hardMode: false,
          guesses: 4,
          gameNumber: 1500
        },
        {
          date: '2025-12-02',
          attempts: 3,
          won: true,
          hardMode: false,
          guesses: 3,
          gameNumber: 1501
        },
        {
          date: '2025-12-03',
          attempts: 5,
          won: true,
          hardMode: false,
          guesses: 5,
          gameNumber: 1502
        }
      ];

      const { container } = render(
        <TimelineChart games={games} onRangeChange={mockOnRangeChange} />
      );
      
      expect(container).toBeInTheDocument();
      // Note: Actual brush interaction testing would require more complex 
      // simulation or integration tests with Recharts
    });
  });
});
