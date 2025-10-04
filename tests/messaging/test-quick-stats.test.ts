import { GetQuickStatsMessage, QuickStatsResponse } from '@/types/messagingTypes';

describe('GetQuickStats Message Contract', () => {
  it('should validate GetQuickStats message structure', () => {
    const validMessage: GetQuickStatsMessage = {
      type: 'GET_QUICK_STATS',
      payload: {
        timeFrame: '30d',
        includeBenchmarks: true
      }
    };

    // Test message validation - should fail until types are implemented
    expect(() => {
      expect(validMessage.type).toBe('GET_QUICK_STATS');
      expect(validMessage.payload.timeFrame).toBe('30d');
      expect(validMessage.payload.includeBenchmarks).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate time frame options', () => {
    const validTimeFrames = ['7d', '30d', '90d', 'ytd', 'all'];
    
    validTimeFrames.forEach(timeFrame => {
      const message: GetQuickStatsMessage = {
        type: 'GET_QUICK_STATS',
        payload: {
          timeFrame: timeFrame as any,
          includeBenchmarks: false
        }
      };

      expect(() => {
        expect(validTimeFrames).toContain(message.payload.timeFrame);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate QuickStatsResponse structure', () => {
    const validResponse: QuickStatsResponse = {
      type: 'QUICK_STATS_RESPONSE',
      payload: {
        userStats: {
          winRate: 85.5,
          averageGuesses: 4.2,
          currentStreak: 12,
          gameCount: 100,
          guessDistribution: [1, 12, 35, 28, 18, 6]
        },
        benchmarks: {
          national: {
            winRate: 78.0,
            averageGuesses: 4.5
          }
        },
        deltas: {
          winRateDelta: 7.5,
          averageGuessesDelta: -0.3
        },
        lastUpdated: '2025-09-27T10:00:00Z'
      }
    };

    expect(() => {
      expect(validResponse.type).toBe('QUICK_STATS_RESPONSE');
      expect(validResponse.payload.userStats.winRate).toBe(85.5);
      expect(validResponse.payload.userStats.guessDistribution).toHaveLength(6);
    }).toThrow(); // Expected to fail in TDD
  });
});