// Dashboard overview page with comprehensive statistics display
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui';
import { StatCard, WinRateDisplay, StreakDisplay } from '@/components/stats';
import { TrendChart, GuessDistributionChart } from '@/components/charts';
import { useGameDataStore } from '@/stores/gameData';
import { useBenchmarksStore } from '@/stores/benchmarks';
import { usePreferencesStore } from '@/stores/preferences';

const OverviewPage: React.FC = () => {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isLoading, setIsLoading] = useState(true);

  // Store hooks
  const { 
    games, 
    getStatisticsForTimeFrame, 
    loadGames,
    isLoading: gamesLoading 
  } = useGameDataStore();
  
  const { 
    getAvailableBenchmarks, 
    getBenchmark 
  } = useBenchmarksStore();
  
  const { defaultTimeFrame } = usePreferencesStore();

  // Set initial time frame from preferences
  useEffect(() => {
    if (defaultTimeFrame && defaultTimeFrame !== selectedTimeFrame) {
      setSelectedTimeFrame(defaultTimeFrame as '7d' | '30d' | '90d' | 'all');
    }
  }, [defaultTimeFrame]);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await loadGames();
      } catch (error) {
        console.error('Failed to load games:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadGames]);

  const statistics = getStatisticsForTimeFrame(selectedTimeFrame);
  const nationalBenchmark = getBenchmark('national');
  const recentGames = games.slice(-30); // Last 30 games for trends

  // Generate trend data
  const trendData = recentGames.map((game, index) => ({
    date: game.date,
    winRate: game.won ? 100 : 0,
    averageGuesses: game.won ? game.guesses || 0 : 0,
    streak: 0 // Would need streak calculation
  }));

  const timeFrameOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' }
  ];

  if (isLoading || gamesLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">
            Your Wordle performance insights and statistics
          </p>
        </div>

        {/* Time Frame Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Time Frame:</span>
          <select
            value={selectedTimeFrame}
            onChange={(e) => setSelectedTimeFrame(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {timeFrameOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Win Rate"
          value={`${statistics.winRate.toFixed(1)}%`}
          subValue={`${statistics.gameCount} games`}
          trend={statistics.winRate > 95 ? 'up' : statistics.winRate < 85 ? 'down' : 'neutral'}
          trendValue={nationalBenchmark ? `${(statistics.winRate - nationalBenchmark.winRate).toFixed(1)}% vs avg` : undefined}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          label="Average Guesses"
          value={statistics.averageGuesses.toFixed(1)}
          subValue="per solved puzzle"
          trend={statistics.averageGuesses < 3.5 ? 'up' : statistics.averageGuesses > 4.5 ? 'down' : 'neutral'}
          trendValue={nationalBenchmark ? `${(statistics.averageGuesses - nationalBenchmark.averageGuesses).toFixed(1)} vs avg` : undefined}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          }
        />

        <StatCard
          label="Current Streak"
          value={statistics.currentStreak.toString()}
          subValue="consecutive wins"
          trend={statistics.currentStreak > statistics.maxStreak * 0.8 ? 'up' : 'neutral'}
          trendValue={`Max: ${statistics.maxStreak}`}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
          }
        />

        <StatCard
          label="Total Games"
          value={statistics.gameCount.toString()}
          subValue={selectedTimeFrame === 'all' ? 'all time' : `in ${selectedTimeFrame}`}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 2V6a1 1 0 112 0v1a1 1 0 11-2 0zm7 0V6a1 1 0 112 0v1a1 1 0 11-2 0z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Win Rate Analysis */}
        <div className="lg:col-span-1">
          <WinRateDisplay
            statistics={statistics}
            benchmark={nationalBenchmark}
            showComparison={true}
          />
        </div>

        {/* Streak Display */}
        <div className="lg:col-span-1">
          <StreakDisplay
            statistics={statistics}
            showHistory={true}
          />
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader title="Quick Actions" />
            <CardContent>
              <div className="space-y-3">
                <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                  Import New Data
                </button>
                <button className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">
                  Export Statistics
                </button>
                <button className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">
                  View Analytics
                </button>
                <button className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors">
                  Settings
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends */}
        <Card>
          <CardHeader title="Performance Trends" subtitle="Your progress over time" />
          <CardContent>
            <TrendChart
              data={trendData}
              metrics={['winRate', 'averageGuesses']}
              showBenchmark={true}
              height={300}
            />
          </CardContent>
        </Card>

        {/* Guess Distribution */}
        <Card>
          <CardHeader title="Solve Distribution" subtitle="How you typically solve puzzles" />
          <CardContent>
            <GuessDistributionChart
              distribution={statistics.guessDistribution}
              comparison={nationalBenchmark?.guessDistribution}
              total={statistics.gameCount}
              showPercentages={true}
              height={300}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader title="Recent Games" subtitle="Your latest Wordle results" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Result</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Guesses</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Game #</th>
                </tr>
              </thead>
              <tbody>
                {recentGames.slice(0, 10).map((game, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm text-gray-900">
                      {new Date(game.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        game.won 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {game.won ? 'Won' : 'Lost'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-900">
                      {game.won ? game.guesses : '—'}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-500">
                      {game.gameNumber || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewPage;