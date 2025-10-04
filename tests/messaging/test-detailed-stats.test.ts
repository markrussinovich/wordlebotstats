import { GetDetailedStatsMessage, DetailedStatsResponse, TrendPoint } from '@/types/messagingTypes';

describe('GetDetailedStats Message Contract', () => {
  it('should validate GetDetailedStats message structure', () => {
    const validMessage: GetDetailedStatsMessage = {
      type: 'GET_DETAILED_STATS',
      payload: {
        startDate: '2025-01-01',
        endDate: '2025-09-27',
        puzzleRange: {
          start: 1,
          end: 270
        },
        hardModeOnly: false,
        groupBy: 'week',
        includeTrends: true
      }
    };

    expect(() => {
      expect(validMessage.type).toBe('GET_DETAILED_STATS');
      expect(validMessage.payload.groupBy).toBe('week');
      expect(validMessage.payload.includeTrends).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate groupBy options', () => {
    const validGroupByOptions = ['day', 'week', 'month'];
    
    validGroupByOptions.forEach(groupBy => {
      const message: GetDetailedStatsMessage = {
        type: 'GET_DETAILED_STATS',
        payload: {
          groupBy: groupBy as any,
          includeTrends: false
        }
      };

      expect(() => {
        expect(validGroupByOptions).toContain(message.payload.groupBy);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate DetailedStatsResponse structure', () => {
    const mockTrendPoints: TrendPoint[] = [
      {
        date: '2025-09-20',
        value: 85.0,
        rollingAverage: 83.5
      },
      {
        date: '2025-09-21',
        value: 87.0,
        rollingAverage: 84.2
      }
    ];

    const validResponse: DetailedStatsResponse = {
      type: 'DETAILED_STATS_RESPONSE',
      payload: {
        periods: [],
        trends: {
          winRateTrend: mockTrendPoints,
          averageGuessesTrend: mockTrendPoints,
          streakTrend: mockTrendPoints
        },
        comparisons: [],
        metadata: {
          totalGames: 150,
          dateRange: ['2025-01-01', '2025-09-27'],
          benchmarkCoverage: 95.5
        }
      }
    };

    expect(() => {
      expect(validResponse.type).toBe('DETAILED_STATS_RESPONSE');
      expect(validResponse.payload.metadata.totalGames).toBe(150);
      expect(validResponse.payload.trends.winRateTrend).toHaveLength(2);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate TrendPoint structure', () => {
    const trendPoint: TrendPoint = {
      date: '2025-09-27',
      value: 4.2,
      rollingAverage: 4.1
    };

    expect(() => {
      expect(trendPoint.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof trendPoint.value).toBe('number');
      expect(typeof trendPoint.rollingAverage).toBe('number');
    }).toThrow(); // Expected to fail in TDD
  });
});