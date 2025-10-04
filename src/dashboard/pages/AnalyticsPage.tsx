// Dashboard analytics page with advanced statistics and comparisons
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui';
import { TrendChart, ComparisonChart, GuessDistributionChart } from '@/components/charts';
import { useGameDataStore } from '@/stores/gameData';
import { useBenchmarksStore } from '@/stores/benchmarks';

const AnalyticsPage: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'winRate' | 'averageGuesses' | 'streak'>('winRate');
  const [selectedComparison, setSelectedComparison] = useState<'national' | 'wordlebot'>('national');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('90d');

  const { games, getStatisticsForTimeFrame } = useGameDataStore();
  const { getBenchmark } = useBenchmarksStore();

  const statistics = getStatisticsForTimeFrame(dateRange);
  const benchmark = getBenchmark(selectedComparison);

  // Generate detailed trend data for the selected period
  const getTrendData = () => {
    const filteredGames = games.slice(-90); // Last 90 games for detailed analysis
    return filteredGames.map((game, index) => ({
      date: game.date,
      winRate: game.won ? 100 : 0,
      averageGuesses: game.won ? (game.guesses || 0) : 0,
      streak: 0, // Would need proper streak calculation
      benchmark: benchmark?.winRate || 98
    }));
  };

  // Generate comparison data
  const getComparisonData = () => {
    return games.slice(-30).map(game => ({
      date: game.date,
      userWinRate: game.won ? 100 : 0,
      userAverageGuesses: game.won ? (game.guesses || 0) : 0,
      benchmarkWinRate: benchmark?.winRate,
      benchmarkAverageGuesses: benchmark?.averageGuesses
    }));
  };

  const metricOptions = [
    { value: 'winRate', label: 'Win Rate' },
    { value: 'averageGuesses', label: 'Average Guesses' },
    { value: 'streak', label: 'Streak Analysis' }
  ];

  const comparisonOptions = [
    { value: 'national', label: 'National Average' },
    { value: 'wordlebot', label: 'WordleBot' }
  ];

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600 mt-1">
            Deep dive into your Wordle performance patterns and trends
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Metric:</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {metricOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Compare to:</label>
            <select
              value={selectedComparison}
              onChange={(e) => setSelectedComparison(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {comparisonOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {statistics.winRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Win Rate</div>
            <div className="text-xs text-gray-500 mt-1">
              {benchmark && `${(statistics.winRate - benchmark.winRate).toFixed(1)}% vs ${selectedComparison}`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {statistics.averageGuesses.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Avg Guesses</div>
            <div className="text-xs text-gray-500 mt-1">
              {benchmark && `${(statistics.averageGuesses - benchmark.averageGuesses).toFixed(1)} vs ${selectedComparison}`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center p-6">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {statistics.currentStreak}
            </div>
            <div className="text-sm text-gray-600">Current Streak</div>
            <div className="text-xs text-gray-500 mt-1">
              Max: {statistics.maxStreak}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Analysis */}
        <Card>
          <CardHeader 
            title="Performance Trends" 
            subtitle={`${selectedMetric} over ${dateRange}`} 
          />
          <CardContent>
            <TrendChart
              data={getTrendData()}
              metrics={[selectedMetric]}
              showBenchmark={true}
              height={350}
            />
          </CardContent>
        </Card>

        {/* Head-to-Head Comparison */}
        <Card>
          <CardHeader 
            title="Performance Comparison" 
            subtitle={`You vs ${selectedComparison}`} 
          />
          <CardContent>
            <ComparisonChart
              data={getComparisonData()}
              height={350}
            />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Distribution Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guess Distribution */}
        <Card>
          <CardHeader title="Solve Distribution" subtitle="Detailed breakdown" />
          <CardContent>
            <GuessDistributionChart
              distribution={statistics.guessDistribution}
              comparison={benchmark?.guessDistribution}
              total={statistics.gameCount}
              showPercentages={true}
              height={300}
            />
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card>
          <CardHeader title="Performance Insights" subtitle="Key findings" />
          <CardContent>
            <div className="space-y-4">
              {/* Efficiency Analysis */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Efficiency Score</h4>
                <div className="text-2xl font-bold text-blue-700 mb-1">
                  {((statistics.guessDistribution[0] + statistics.guessDistribution[1] + statistics.guessDistribution[2]) / statistics.gameCount * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-blue-600">
                  Games solved in 3 or fewer guesses
                </p>
              </div>

              {/* Consistency Analysis */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Consistency</h4>
                <div className="text-2xl font-bold text-green-700 mb-1">
                  {statistics.guessDistribution.indexOf(Math.max(...statistics.guessDistribution)) + 1}
                </div>
                <p className="text-sm text-green-600">
                  Most common solve attempts
                </p>
              </div>

              {/* Difficulty Adaptation */}
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-2">Streak Potential</h4>
                <div className="text-2xl font-bold text-orange-700 mb-1">
                  {Math.round((statistics.currentStreak / statistics.maxStreak) * 100) || 0}%
                </div>
                <p className="text-sm text-orange-600">
                  Current vs best streak
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Analytics Table */}
      <Card>
        <CardHeader title="Detailed Statistics" subtitle="Comprehensive breakdown" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Metric</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Your Value</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Benchmark</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Difference</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Percentile</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm text-gray-900">Win Rate</td>
                  <td className="py-3 px-4 text-sm font-medium">{statistics.winRate.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{benchmark?.winRate?.toFixed(1)}%</td>
                  <td className={`py-3 px-4 text-sm font-medium ${
                    (statistics.winRate - (benchmark?.winRate || 0)) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {benchmark ? `${(statistics.winRate - benchmark.winRate).toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {benchmark ? `${Math.round(50 + (statistics.winRate - benchmark.winRate) * 2)}th` : '—'}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm text-gray-900">Average Guesses</td>
                  <td className="py-3 px-4 text-sm font-medium">{statistics.averageGuesses.toFixed(2)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{benchmark?.averageGuesses?.toFixed(2)}</td>
                  <td className={`py-3 px-4 text-sm font-medium ${
                    (statistics.averageGuesses - (benchmark?.averageGuesses || 0)) < 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {benchmark ? `${(statistics.averageGuesses - benchmark.averageGuesses).toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {benchmark ? `${Math.round(50 - (statistics.averageGuesses - benchmark.averageGuesses) * 20)}th` : '—'}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm text-gray-900">Total Games</td>
                  <td className="py-3 px-4 text-sm font-medium">{statistics.gameCount}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">—</td>
                  <td className="py-3 px-4 text-sm text-gray-600">—</td>
                  <td className="py-3 px-4 text-sm text-gray-600">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;