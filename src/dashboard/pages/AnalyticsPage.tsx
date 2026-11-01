import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameDataStore } from '@/stores/gameData';
import SolveAnalytics from '../components/SolveAnalytics';
import TimelineChart from '@/components/charts/TimelineChart';
import { useSolver } from '../hooks/useSolver';
import { localPuzzleDate } from '@/types/playTypes';
import { usePlayHistory } from '@/play/usePlayHistory';

const AnalyticsPage: React.FC = () => {
  const importedGames = useGameDataStore((state) => state.games);
  const { displayGames: games } = usePlayHistory(importedGames);
  const solver = useSolver(games);
  const [period, setPeriod] = useState('all');
  const [range, setRange] = useState<{ start: string; end: string } | null>(
    null
  );
  const filtered = useMemo(() => {
    if (period === 'all') return games;
    const start = new Date();
    start.setDate(start.getDate() - Number(period) + 1);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    return games.filter((game) => game.date >= date);
  }, [games, period]);
  const selectedGames = range
    ? filtered.filter(
        (game) => game.date >= range.start && game.date <= range.end
      )
    : filtered;
  return (
    <main className="dashboard-container">
      <Link to="/">Overview</Link>
      {' | '}
      <Link to="/play">Play Wordle</Link>
      <label className="solve-controls">
        Period:
        <select
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setRange(null);
          }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </label>
      <section
        className="chart-section"
        aria-labelledby="analytics-timeline-heading"
      >
        <h2 className="section-title" id="analytics-timeline-heading">
          Performance Timeline
        </h2>
        <p className="section-subtitle">
          Toggle metrics to compare turns, solver results, NYT readers, skill,
          and luck. Drag the range handles to zoom.
        </p>
        <TimelineChart
          key={period}
          games={filtered}
          solverResults={solver.results}
          onRangeChange={(start, end) => {
            const dateKey = (date: Date) =>
              `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            setRange({ start: dateKey(start), end: dateKey(end) });
          }}
        />
      </section>
      <SolveAnalytics
        games={selectedGames}
        allGames={games}
        solver={solver}
        dateRange={
          range ||
          (period === 'all'
            ? undefined
            : {
                start: localPuzzleDate(
                  new Date(Date.now() - (Number(period) - 1) * 86400000)
                ),
              })
        }
      />
    </main>
  );
};

export default AnalyticsPage;
