// Win rate display component with visual progress and comparisons
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui';
import { StatisticsPeriod } from '@/types/gameTypes';
import { BenchmarkData } from '@/types/benchmarkTypes';

export interface WinRateDisplayProps {
  statistics: StatisticsPeriod;
  benchmark?: BenchmarkData;
  showComparison?: boolean;
  className?: string;
}

const WinRateDisplay: React.FC<WinRateDisplayProps> = ({
  statistics,
  benchmark,
  showComparison = true,
  className = ''
}) => {
  const winRate = statistics.winRate;
  const benchmarkRate = benchmark?.winRate || 98; // Default national average
  const delta = winRate - benchmarkRate;
  const isAbove = delta > 0;

  // Calculate visual progress bar width (0-100%)
  const progressWidth = Math.min(Math.max(winRate, 0), 100);
  const benchmarkPosition = Math.min(Math.max(benchmarkRate, 0), 100);

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getDeltaColor = (delta: number) => {
    if (Math.abs(delta) < 1) return 'text-gray-500';
    return delta > 0 ? 'text-green-600' : 'text-red-600';
  };

  const getDeltaIcon = (delta: number) => {
    if (Math.abs(delta) < 1) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return delta > 0 ? (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <Card className={className}>
      <CardHeader title="Win Rate" />
      <CardContent>
        <div className="space-y-4">
          {/* Main Win Rate Display */}
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-1">
              {formatPercentage(winRate)}
            </div>
            <div className="text-sm text-gray-500">
              {statistics.gameCount} games played
            </div>
          </div>

          {/* Progress Bar with Benchmark */}
          <div className="relative">
            {/* Background track */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              {/* User progress */}
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  winRate >= 95 ? 'bg-green-500' : winRate >= 85 ? 'bg-blue-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${progressWidth}%` }}
              />
              
              {/* Benchmark indicator */}
              {showComparison && (
                <div
                  className="absolute top-0 w-1 h-3 bg-gray-700 transform -translate-x-0.5"
                  style={{ left: `${benchmarkPosition}%` }}
                  title={`Benchmark: ${formatPercentage(benchmarkRate)}`}
                />
              )}
            </div>
            
            {/* Scale markers */}
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Comparison with Benchmark */}
          {showComparison && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">
                    vs. {benchmark?.source === 'national' ? 'National Average' : 'WordleBot'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatPercentage(benchmarkRate)}
                  </div>
                </div>
                
                <div className={`flex items-center space-x-1 ${getDeltaColor(delta)}`}>
                  {getDeltaIcon(delta)}
                  <span className="text-sm font-medium">
                    {Math.abs(delta) < 0.1 ? 'Same' : `${isAbove ? '+' : ''}${delta.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              
              {/* Performance insight */}
              <div className="mt-2 text-xs text-gray-600">
                {delta > 5 ? 'Excellent performance! You\'re significantly above average.' :
                 delta > 2 ? 'Great job! You\'re performing above average.' :
                 delta > -2 ? 'You\'re performing close to the average.' :
                 delta > -5 ? 'Room for improvement. Consider strategy adjustments.' :
                 'Focus on consistency and strategy improvement.'}
              </div>
            </div>
          )}

          {/* Win/Loss Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-semibold text-green-700">
                {statistics.gameCount - (statistics.gameCount - Math.round(statistics.gameCount * statistics.winRate / 100))}
              </div>
              <div className="text-xs text-green-600">Wins</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-semibold text-red-700">
                {statistics.gameCount - Math.round(statistics.gameCount * statistics.winRate / 100)}
              </div>
              <div className="text-xs text-red-600">Losses</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WinRateDisplay;