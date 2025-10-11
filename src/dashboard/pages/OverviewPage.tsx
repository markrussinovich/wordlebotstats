// Dashboard overview page with comprehensive statistics display
import React, { useState, useEffect } from 'react';
import TimelineChart from '@/components/charts/TimelineChart';
import TurnDistributionBar from '@/components/charts/TurnDistributionBar';
import { useGameDataStore } from '@/stores/gameData';
import { calculateStreakStats } from '@/utils/streakCalculation';

const OverviewPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [rangeStreaks, setRangeStreaks] = useState<{ current: number; max: number } | null>(null);
  const [filteredGames, setFilteredGames] = useState<any[]>([]);

  // Store hooks
  const { 
    games, 
    getStatisticsForTimeFrame, 
    isLoading: gamesLoading 
  } = useGameDataStore();

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
    // Recalculate streaks for the selected range
    // This uses all games but with the endDate as the right edge of the range
    const streaks = calculateStreakStats(games, startDate, endDate);
    setRangeStreaks({ current: streaks.currentStreak, max: streaks.maxStreak });
    
    // Filter games by selected date range
    const filtered = games.filter(game => {
      const gameDate = new Date(game.date);
      return gameDate >= startDate && gameDate <= endDate;
    });
    setFilteredGames(filtered);
    
    console.log('[OverviewPage] Range selected:', {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      currentStreak: streaks.currentStreak,
      maxStreak: streaks.maxStreak,
      filteredGames: filtered.length
    });
  };

  // Initialize streak data for all games on mount
  useEffect(() => {
    if (games.length > 0) {
      // Calculate initial streaks for all games - need to provide date range
      const sortedGames = [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const startDate = new Date(sortedGames[0].date);
      const endDate = new Date(sortedGames[sortedGames.length - 1].date);
      const allStreaks = calculateStreakStats(games, startDate, endDate);
      setRangeStreaks({ current: allStreaks.currentStreak, max: allStreaks.maxStreak });
      
      // Initialize filtered games with all games
      setFilteredGames(games);
      
      console.log('[OverviewPage] Sample games:', games.slice(0, 5));
      console.log('[OverviewPage] Statistics:', statistics);
      
      // Correct categorization: 0=unplayed, 1-6=win, 7+=loss
      const unplayed = games.filter(g => !g.attempts || g.attempts === 0).length;
      const wins = games.filter(g => g.attempts && g.attempts >= 1 && g.attempts <= 6).length;
      const losses = games.filter(g => g.attempts && g.attempts >= 7).length;
      
      console.log('[OverviewPage] Total games:', games.length);
      console.log('[OverviewPage] Unplayed (0 attempts):', unplayed);
      console.log('[OverviewPage] Wins (1-6 attempts):', wins);
      console.log('[OverviewPage] Losses (7+ attempts):', losses);
      console.log('[OverviewPage] Played games:', wins + losses);
    }
  }, [games, statistics]);

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
        
        <div className="stat-item stat-item-streaks">
          <div className="streak-group">
            <div className="streak-stat">
              <div className="stat-label">Current Streak</div>
              <div className="stat-value stat-streak">
                {rangeStreaks ? rangeStreaks.current : (statistics?.currentStreak || 0)}
              </div>
            </div>
            <div className="streak-stat">
              <div className="stat-label">Longest Streak</div>
              <div className="stat-value stat-streak">
                {rangeStreaks ? rangeStreaks.max : (statistics?.maxStreak || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="chart-section">
        <h2 className="section-title">Performance Timeline</h2>
        <p className="section-subtitle">
          Click and drag to select a date range and zoom in. Streaks and turn distribution update based on selected range.
        </p>
        
        <TimelineChart 
          games={games} 
          onRangeChange={handleRangeChange}
          turnDistribution={<TurnDistributionBar games={filteredGames.length > 0 ? filteredGames : games} />}
          streakData={rangeStreaks}
        />
      </div>
    </div>
  );
};

export default OverviewPage;