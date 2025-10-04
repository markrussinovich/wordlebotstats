// Guess distribution chart showing frequency of solving in each attempt
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface GuessDistributionProps {
  distribution: number[]; // Array of 6 numbers representing guesses 1-6
  comparison?: number[]; // Optional benchmark distribution
  total?: number; // Total games for percentage calculation
  showPercentages?: boolean;
  height?: number;
  className?: string;
}

const GuessDistributionChart: React.FC<GuessDistributionProps> = ({
  distribution,
  comparison,
  total,
  showPercentages = false,
  height = 300,
  className = ''
}) => {
  // Transform data for Recharts
  const chartData = distribution.map((count, index) => {
    const guess = index + 1;
    const percentage = total ? (count / total) * 100 : 0;
    const comparisonCount = comparison ? comparison[index] : 0;
    const comparisonPercentage = total && comparison ? (comparisonCount / total) * 100 : 0;

    return {
      guess: guess.toString(),
      count,
      percentage,
      comparisonCount,
      comparisonPercentage,
      label: `${guess} ${guess === 1 ? 'guess' : 'guesses'}`
    };
  });

  const formatTooltip = (value: number, name: string) => {
    if (name === 'percentage' || name === 'comparisonPercentage') {
      return [`${value.toFixed(1)}%`, name === 'percentage' ? 'Your Rate' : 'Benchmark'];
    }
    return [value, name === 'count' ? 'Your Games' : 'Benchmark'];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{data.label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {formatTooltip(entry.value, entry.dataKey).join(': ')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const maxValue = Math.max(
    ...distribution,
    ...(comparison || [])
  );

  const yAxisMax = showPercentages 
    ? Math.ceil(Math.max(...chartData.map(d => Math.max(d.percentage, d.comparisonPercentage))) / 10) * 10
    : Math.ceil(maxValue / 10) * 10;

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Guess Distribution
        </h3>
        <p className="text-sm text-gray-600">
          {showPercentages 
            ? 'Percentage of games solved in each number of guesses'
            : 'Number of games solved in each number of guesses'
          }
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          
          <XAxis 
            dataKey="guess"
            className="text-sm text-gray-600"
          />
          
          <YAxis 
            domain={[0, yAxisMax]}
            tickFormatter={showPercentages ? (value) => `${value}%` : undefined}
            className="text-sm text-gray-600"
          />

          <Tooltip content={<CustomTooltip />} />
          
          {comparison && (
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              className="text-sm"
            />
          )}

          {/* User's distribution */}
          <Bar
            dataKey={showPercentages ? 'percentage' : 'count'}
            name="Your Games"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
          />

          {/* Comparison distribution */}
          {comparison && (
            <Bar
              dataKey={showPercentages ? 'comparisonPercentage' : 'comparisonCount'}
              name="Benchmark"
              fill="#9ca3af"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* Statistics Summary */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm font-medium text-blue-800">Most Common</div>
          <div className="text-lg font-bold text-blue-900">
            {distribution.indexOf(Math.max(...distribution)) + 1} guesses
          </div>
          <div className="text-xs text-blue-600">
            {Math.max(...distribution)} games 
            {total && ` (${((Math.max(...distribution) / total) * 100).toFixed(1)}%)`}
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm font-medium text-green-800">Efficiency</div>
          <div className="text-lg font-bold text-green-900">
            {total ? ((distribution[0] + distribution[1] + distribution[2]) / total * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-green-600">
            Solved in ≤3 guesses
          </div>
        </div>
      </div>

      {/* Visual Distribution Bars (Alternative minimal view) */}
      <div className="mt-4 space-y-2">
        <div className="text-sm font-medium text-gray-700 mb-2">Quick View</div>
        {chartData.map((item, index) => {
          const width = total ? (item.count / Math.max(...distribution)) * 100 : 0;
          return (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-8 text-sm text-gray-600 text-right">{item.guess}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(width, 5)}%` }}
                >
                  {item.count > 0 && (
                    <span className="text-xs font-medium text-white">
                      {item.count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuessDistributionChart;