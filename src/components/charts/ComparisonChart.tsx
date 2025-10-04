// Performance comparison chart for user vs benchmarks
import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface ComparisonDataPoint {
  date: string;
  userWinRate: number;
  userAverageGuesses: number;
  benchmarkWinRate?: number;
  benchmarkAverageGuesses?: number;
  difficulty?: number; // Optional puzzle difficulty rating
}

export interface ComparisonChartProps {
  data: ComparisonDataPoint[];
  showDifficulty?: boolean;
  height?: number;
  className?: string;
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({
  data,
  showDifficulty = false,
  height = 400,
  className = ''
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatGuesses = (value: number) => value.toFixed(1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{formatDate(label)}</p>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-600">Your Win Rate:</span>
              <span className="font-medium text-blue-800">{formatPercentage(data.userWinRate)}</span>
            </div>
            
            {data.benchmarkWinRate && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Benchmark:</span>
                <span className="font-medium text-gray-800">{formatPercentage(data.benchmarkWinRate)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600">Your Avg Guesses:</span>
              <span className="font-medium text-green-800">{formatGuesses(data.userAverageGuesses)}</span>
            </div>
            
            {data.benchmarkAverageGuesses && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Benchmark:</span>
                <span className="font-medium text-gray-800">{formatGuesses(data.benchmarkAverageGuesses)}</span>
              </div>
            )}
            
            {showDifficulty && data.difficulty && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-orange-600">Difficulty:</span>
                <span className="font-medium text-orange-800">{data.difficulty.toFixed(1)}/10</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Performance Comparison
        </h3>
        <p className="text-sm text-gray-600">
          Your performance vs benchmark over time
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          
          <XAxis 
            dataKey="date"
            tickFormatter={formatDate}
            className="text-xs text-gray-600"
          />
          
          {/* Left Y-axis for win rates */}
          <YAxis 
            yAxisId="winRate"
            domain={[0, 100]}
            tickFormatter={formatPercentage}
            className="text-xs text-gray-600"
          />
          
          {/* Right Y-axis for average guesses */}
          <YAxis 
            yAxisId="guesses"
            orientation="right"
            domain={[1, 6]}
            tickFormatter={formatGuesses}
            className="text-xs text-gray-600"
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend className="text-sm" />

          {/* Win Rate Comparison (Bars) */}
          <Bar
            yAxisId="winRate"
            dataKey="userWinRate"
            name="Your Win Rate"
            fill="#3b82f6"
            opacity={0.8}
            radius={[2, 2, 0, 0]}
          />

          {data[0]?.benchmarkWinRate && (
            <Bar
              yAxisId="winRate"
              dataKey="benchmarkWinRate"
              name="Benchmark Win Rate"
              fill="#9ca3af"
              opacity={0.6}
              radius={[2, 2, 0, 0]}
            />
          )}

          {/* Average Guesses (Lines) */}
          <Line
            yAxisId="guesses"
            type="monotone"
            dataKey="userAverageGuesses"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Your Avg Guesses"
          />

          {data[0]?.benchmarkAverageGuesses && (
            <Line
              yAxisId="guesses"
              type="monotone"
              dataKey="benchmarkAverageGuesses"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
              name="Benchmark Avg Guesses"
            />
          )}

          {/* Difficulty overlay */}
          {showDifficulty && (
            <Line
              yAxisId="guesses"
              type="monotone"
              dataKey="difficulty"
              stroke="#f59e0b"
              strokeWidth={1}
              opacity={0.7}
              dot={false}
              name="Puzzle Difficulty"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Performance Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-sm font-medium text-blue-800">Win Rate Delta</div>
          <div className="text-lg font-bold text-blue-900">
            {(() => {
              const avgUserWinRate = data.reduce((sum, d) => sum + d.userWinRate, 0) / data.length;
              const avgBenchmarkWinRate = data.reduce((sum, d) => sum + (d.benchmarkWinRate || 0), 0) / data.length;
              const delta = avgUserWinRate - avgBenchmarkWinRate;
              return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
            })()}
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-sm font-medium text-green-800">Efficiency Delta</div>
          <div className="text-lg font-bold text-green-900">
            {(() => {
              const avgUserGuesses = data.reduce((sum, d) => sum + d.userAverageGuesses, 0) / data.length;
              const avgBenchmarkGuesses = data.reduce((sum, d) => sum + (d.benchmarkAverageGuesses || 0), 0) / data.length;
              const delta = avgBenchmarkGuesses - avgUserGuesses; // Inverted because lower is better
              return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
            })()}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg text-center">
          <div className="text-sm font-medium text-gray-800">Games Tracked</div>
          <div className="text-lg font-bold text-gray-900">
            {data.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonChart;