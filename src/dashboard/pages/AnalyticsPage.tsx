import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameDataStore } from '@/stores/gameData';
import SolveAnalytics from '../components/SolveAnalytics';

const AnalyticsPage: React.FC = () => {
  const games = useGameDataStore((state) => state.games);
  const [period, setPeriod] = useState('all');
  const filtered = useMemo(() => {
    if (period === 'all') return games;
    const start = new Date();
    start.setDate(start.getDate() - Number(period) + 1);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    return games.filter((game) => game.date >= date);
  }, [games, period]);
  return (
    <main className="dashboard-container">
      <Link to="/">Overview</Link>
      <label className="solve-controls">
        Period:
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </label>
      <SolveAnalytics games={filtered} allGames={games} />
    </main>
  );
};

export default AnalyticsPage;
