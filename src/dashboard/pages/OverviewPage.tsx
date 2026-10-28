// Dashboard overview page with comprehensive statistics display
import React, { useState, useEffect } from 'react';
import TimelineChart from '@/components/charts/TimelineChart';
import TurnDistributionBar from '@/components/charts/TurnDistributionBar';
import { useGameDataStore } from '@/stores/gameData';
import { calculateStreakStats } from '@/utils/streakCalculation';
import SolveAnalytics from '../components/SolveAnalytics';
import { GameResult } from '@/types/gameTypes';
import { useSolver } from '../hooks/useSolver';

const OverviewPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [rangeStreaks, setRangeStreaks] = useState<{ current: number; max: number } | null>(null);
  const [filteredGames, setFilteredGames] = useState<GameResult[]>([]);
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date } | null>(null);

  // Store hooks
  const { 
    games, 
    getStatisticsForTimeFrame, 
    isLoading: gamesLoading 
  } = useGameDataStore();
  const solver = useSolver(games);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Data is loaded by the useDashboardData hook in DashboardApp
        // Just mark loading as complete
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load games:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const statistics = getStatisticsForTimeFrame('all');

  // Handle timeline range selection
  const handleRangeChange = (startDate: Date, endDate: Date) => {
    setSelectedDates({ start: startDate, end: endDate });
  };

  // Initialize streak data for all games on mount
  useEffect(() => {
    if (games.length > 0) {
      // Calculate initial streaks for all games - need to provide date range
      const sortedGames = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const startDate = selectedDates?.start ?? new Date(`${sortedGames[0].date}T00:00:00`);
      const endDate = selectedDates?.end ?? new Date(`${sortedGames[sortedGames.length - 1].date}T00:00:00`);
      const allStreaks = calculateStreakStats(games, startDate, endDate);
      setRangeStreaks({ current: allStreaks.currentStreak, max: allStreaks.maxStreak });
      
      const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const start = dateKey(startDate);
      const end = dateKey(endDate);
      setFilteredGames(games.filter(game => game.date >= start && game.date <= end));
    }
  }, [games, selectedDates]);

  if (isLoading || gamesLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading your Wordle stats...</div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="dashboard-empty">
        <h2>No Games Found</h2>
        <p>Visit the WordleBot page to import your game history.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Wordle Stat Explorer</h1>
        <p className="subtitle">Your complete Wordle performance history</p>
      </div>

      {/* Stats Panel */}
      <div className="stats-panel">
        <div className="stat-item">
          <div className="stat-label">Total Games</div>
          <div className="stat-value">{statistics?.gameCount || 0}</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Total Wins</div>
          <div className="stat-value stat-wins">{statistics?.winCount || 0}</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Total Losses</div>
          <div className="stat-value stat-losses">
            {statistics ? (statistics.gameCount - statistics.winCount) : 0}
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Average Turns</div>
          <div className="stat-value">
            {statistics?.averageGuesses ? statistics.averageGuesses.toFixed(2) : '—'}
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">Current Streak</div>
          <div className="stat-value stat-streak">
            {rangeStreaks ? rangeStreaks.current : (statistics?.currentStreak || 0)}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Longest Streak</div>
          <div className="stat-value stat-streak">
            {rangeStreaks ? rangeStreaks.max : (statistics?.maxStreak || 0)}
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="chart-section">
        <h2 className="section-title">Performance Timeline</h2>
        <p className="section-subtitle">
          Compare turns, solver results, NYT readers, skill, and luck. Drag the range handles to update all comparisons and game tiles.
        </p>
        
        <TimelineChart 
          games={games} 
          solverResults={solver.results}
          onRangeChange={handleRangeChange}
          turnDistribution={<TurnDistributionBar games={filteredGames} />}
          streakData={rangeStreaks}
        />
      </div>
      <SolveAnalytics games={filteredGames} allGames={games} solver={solver} />
    </div>
  );
};

export default OverviewPage;