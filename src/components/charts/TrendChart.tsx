// Trend chart component for visualizing performance over time
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface TrendDataPoint {
  date: string;
  winRate?: number;
  averageGuesses?: number;
  streak?: number;
  benchmark?: number;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  metrics?: ('winRate' | 'averageGuesses' | 'streak')[];
  showBenchmark?: boolean;
  height?: number;
  className?: string;
}

const TrendChart: React.FC<TrendChartProps> = ({
  data,
  metrics = ['winRate'],
  showBenchmark = false,
  height = 300,
  className = ''
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatGuesses = (value: number) => value.toFixed(1);

  const getMetricConfig = (metric: string) => {
    switch (metric) {
      case 'winRate':
        return {
          stroke: '#3b82f6',
          name: 'Win Rate (%)',
          formatter: formatPercentage,
          yAxisId: 'percentage'
        };
      case 'averageGuesses':
        return {
          stroke: '#10b981',
          name: 'Avg Guesses',
          formatter: formatGuesses,
          yAxisId: 'guesses'
        };
      case 'streak':
        return {
          stroke: '#f59e0b',
          name: 'Streak',
          formatter: (value: number) => value.toString(),
          yAxisId: 'count'
        };
      default:
        return {
          stroke: '#6b7280',
          name: metric,
          formatter: (value: number) => value.toString(),
          yAxisId: 'default'
        };
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => {
            const config = getMetricConfig(entry.dataKey);
            return (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: {config.formatter(entry.value)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const hasMultipleYAxes = metrics.some(m => getMetricConfig(m).yAxisId === 'guesses') && 
                          metrics.some(m => getMetricConfig(m).yAxisId !== 'guesses');

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          
          <XAxis 
            dataKey="date"
            tickFormatter={formatDate}
            className="text-xs text-gray-600"
          />
          
          {/* Primary Y-axis (percentage/count) */}
          <YAxis 
            yAxisId="percentage"
            domain={[0, 100]}
            tickFormatter={formatPercentage}
            className="text-xs text-gray-600"
          />
          
          {/* Secondary Y-axis for guesses */}
          {hasMultipleYAxes && (
            <YAxis 
              yAxisId="guesses"
              orientation="right"
              domain={[1, 6]}
              tickFormatter={formatGuesses}
              className="text-xs text-gray-600"
            />
          )}

          <Tooltip content={<CustomTooltip />} />
          <Legend className="text-sm" />

          {/* Benchmark line */}
          {showBenchmark && (
            <Line
              yAxisId="percentage"
              type="monotone"
              dataKey="benchmark"
              stroke="#9ca3af"
              strokeDasharray="5 5"
              dot={false}
              name="Benchmark"
              opacity={0.7}
            />
          )}

          {/* Metric lines */}
          {metrics.map((metric, index) => {
            const config = getMetricConfig(metric);
            return (
              <Line
                key={metric}
                yAxisId={config.yAxisId}
                type="monotone"
                dataKey={metric}
                stroke={config.stroke}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={config.name}
                connectNulls={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;