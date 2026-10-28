import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GameResult } from '@/types/gameTypes';
import { MessageType } from '@/types/messagingTypes';
import { SOLVER_DESCRIPTION } from '@/solver/solver';
import { useSolver } from '../hooks/useSolver';
import { useGameDataStore } from '@/stores/gameData';
import {
  buildSolveComparison,
  comparisonTrend,
  pairedComparison,
} from '@/utils/solveComparison';

interface Props {
  games: GameResult[];
  allGames?: GameResult[];
}

const formatTurns = (value: number | null) =>
  value === null
    ? 'N/A'
    : value === 7
      ? 'X/6'
      : value.toFixed(value % 1 ? 2 : 0);

const SolveAnalytics: React.FC<Props> = ({ games, allGames = games }) => {
  const { results, running, error } = useSolver(allGames);
  const addGame = useGameDataStore((state) => state.addGame);
  const attemptedReaders = useRef(new Set<string>());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const game of [...allGames].sort((a, b) =>
        b.date.localeCompare(a.date)
      )) {
        if (cancelled) return;
        const key = `${game.date}:${game.hardMode}`;
        if (
          !game.solution ||
          game.nytReaderSource === 'manual' ||
          attemptedReaders.current.has(key)
        )
          continue;
        attemptedReaders.current.add(key);
        try {
          const response = await chrome.runtime.sendMessage({
            type: MessageType.GET_NYT_READER_AVERAGE,
            date: game.date,
          });
          if (response?.success && response.game) addGame(response.game);
        } catch {
          // Reader data is optional; missing figures do not prevent analytics.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allGames, addGame]);
  const [trend, setTrend] = useState(true);
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const points = useMemo(
    () => buildSolveComparison(games, results),
    [games, results]
  );
  const chart = useMemo(
    () => (trend ? comparisonTrend(points) : points),
    [points, trend]
  );
  const solverPair = pairedComparison(points, 'solver');
  const readerPair = pairedComparison(points, 'readers');
  const pages = Math.max(1, Math.ceil(points.length / 24));
  const currentPage = Math.min(page, pages - 1);
  const tiles = [...points]
    .reverse()
    .slice(currentPage * 24, (currentPage + 1) * 24);

  const saveReaders = async (event: React.FormEvent, game: GameResult) => {
    event.preventDefault();
    const value = Number(drafts[game.date] ?? game.nytReaderAverage ?? '');
    if (!Number.isFinite(value) || value < 1 || value > 7) {
      setSaveError('Enter the per-puzzle NYT reader average between 1 and 7.');
      return;
    }
    setSaving(game.date);
    setSaveError(null);
    try {
      const updated: GameResult = {
        ...game,
        nytReaderAverage: value,
        nytReaderSource: 'manual',
      };
      const response = await chrome.runtime.sendMessage({
        type: MessageType.IMPORT_GAME_RESULT,
        gameResult: updated,
        source: 'manual',
        timestamp: Date.now(),
      });
      if (!response?.success)
        throw new Error(
          response?.error || 'Reader average could not be saved.'
        );
      addGame(updated);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Reader average could not be saved.'
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <section
      className="chart-section solve-analytics"
      aria-labelledby="solve-heading"
    >
      <h2 id="solve-heading" className="section-title">
        Solve analytics: you, NYT readers, and a local solver
      </h2>
      <p className="section-subtitle">
        Compare your turns with NYT readers and a local normal-mode solver.
      </p>
      <details className="solve-methodology">
        <summary>About the solver and NYT reader data</summary>
        <p>{SOLVER_DESCRIPTION}</p>
        <p>
          NYT reader averages load from WordleBot&apos;s per-puzzle summaries.
          Reader mode is shown in each game&apos;s details; normal mode is used
          when history does not identify a mode. Missing figures are N/A, never
          a national estimate. You can also enter a figure in a game&apos;s
          details.
        </p>
      </details>
      <p>
        Failures count as 7 turns in comparisons (shown as X/6). Unplayed games
        are excluded from head-to-head averages. Solver results use normal mode
        even if you played hard mode.
      </p>
      {running && (
        <p role="status">Calculating solver paths in the background...</p>
      )}
      {error && <p role="alert">{error}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      <div className="solve-summary">
        {(
          [
            ['Local solver', solverPair],
            ['NYT readers', readerPair],
          ] as const
        ).map(([label, pair]) => (
          <div className="stat-item solve-tile" key={label}>
            <h3 className="stat-label">You vs {label}</h3>
            {pair ? (
              <>
                <strong className="stat-value">
                  {pair.delta > 0 ? '+' : ''}
                  {pair.delta.toFixed(2)} turns
                </strong>
                <p>
                  You {pair.user.toFixed(2)} / {label}{' '}
                  {pair.benchmark.toFixed(2)}
                </p>
                <p>{pair.count} matched games; negative is better.</p>
              </>
            ) : (
              <p>No matched games available.</p>
            )}
          </div>
        ))}
      </div>
      <label className="solve-controls">
        Plot:
        <select
          value={trend ? 'trend' : 'daily'}
          onChange={(event) => setTrend(event.target.value === 'trend')}
        >
          <option value="trend">
            20-game rolling average (available observations)
          </option>
          <option value="daily">Individual games</option>
        </select>
      </label>
      {points.length ? (
        <div className="solve-chart" aria-label="Solve turns comparison chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chart}
              margin={{ top: 20, right: 5, left: 5, bottom: 20 }}
            >
              <CartesianGrid
                stroke="var(--cp-chart-grid)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                stroke="var(--cp-chart-axis)"
                style={{ fontSize: '12px' }}
                tickFormatter={(date: string) =>
                  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                minTickGap={60}
              />
              <YAxis
                domain={[1, 7]}
                ticks={[1, 2, 3, 4, 5, 6, 7]}
                stroke="var(--cp-chart-axis)"
                style={{ fontSize: '12px' }}
                label={{ value: 'Turns', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <div className="tooltip-date">{label}</div>
                      {payload.map((entry) => (
                        <p key={String(entry.dataKey)}>
                          {entry.name}: {formatTurns(Number(entry.value))}
                        </p>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Line
                type="monotone"
                dataKey="user"
                name="You"
                stroke="var(--cp-chart-turns)"
                strokeWidth={3}
                dot={!trend}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="solver"
                name="Local solver"
                stroke="var(--cp-wordle-green)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={!trend}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="readers"
                name="NYT readers"
                stroke="var(--cp-chart-readers)"
                strokeWidth={2}
                strokeDasharray="2 3"
                dot={!trend}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="chart-legend-custom" aria-label="Chart legend">
            <span className="legend-item">
              <span className="legend-line solve-legend-user" />
              You
            </span>
            <span className="legend-item">
              <span className="legend-line solve-legend-solver" />
              Local solver
            </span>
            <span className="legend-item">
              <span className="legend-line solve-legend-readers" />
              NYT readers
            </span>
          </div>
        </div>
      ) : (
        <p>No games in the selected range.</p>
      )}
      <h3 className="section-title">Individual games</h3>
      <p>
        Expand a tile to reveal the answer and the solver&apos;s actual guess
        sequence.
      </p>
      <div className="solve-games">
        {tiles.map((point) => (
          <details className="stat-item solve-tile" key={point.date}>
            <summary>
              <span>
                {point.date}
                {point.game.hardMode ? ' (hard mode)' : ''}
              </span>
              <span className="solve-turns">
                <span>
                  You <strong>{formatTurns(point.user)}</strong>
                </span>
                <span>
                  Solver{' '}
                  <strong>
                    {!point.result && running
                      ? '...'
                      : formatTurns(point.solver)}
                  </strong>
                </span>
                <span>
                  NYT readers <strong>{formatTurns(point.readers)}</strong>
                </span>
              </span>
            </summary>
            <h4>Answer: {point.game.solution || 'Unknown'}</h4>
            {point.result?.guesses.length ? (
              <div aria-label={`Solver solution for ${point.date}`}>
                {point.result.guesses.map((guess, index) => (
                  <div className="solve-guess" key={index}>
                    <span
                      className="solve-feedback"
                      aria-label={`${guess.word}: ${guess.feedback.map((cell) => cell.status).join(', ')}`}
                    >
                      {guess.feedback.map((cell, cellIndex) => (
                        <span
                          aria-hidden="true"
                          key={cellIndex}
                          className={`solve-cell solve-cell-${cell.status}`}
                        >
                          {cell.letter}
                        </span>
                      ))}
                    </span>
                    <small>{guess.remaining} candidates</small>
                  </div>
                ))}
                {point.result.status === 'failed' && (
                  <p>Not solved within six turns.</p>
                )}
              </div>
            ) : (
              <p>
                {point.result?.status === 'unavailable'
                  ? 'Answer is outside the bundled dictionary; no solver result.'
                  : point.game.solution && running
                    ? 'Solver is still calculating.'
                    : 'No solver path available.'}
              </p>
            )}
            <p>
              NYT reader source:{' '}
              {point.game.nytReaderSource === 'manual'
                ? 'user-entered from WordleBot'
                : point.readers !== null
                  ? `WordleBot${point.game.nytReaderMode ? ` (${point.game.nytReaderMode} mode)` : ''}`
                  : 'unavailable'}
              .
            </p>
            <form
              onSubmit={(event) => void saveReaders(event, point.game)}
              className="solve-reader-form"
            >
              <label>
                NYT readers&apos; average for {point.date}
                <input
                  type="number"
                  min="1"
                  max="7"
                  step="0.01"
                  value={
                    drafts[point.date] ?? point.game.nytReaderAverage ?? ''
                  }
                  onChange={(event) =>
                    setDrafts({ ...drafts, [point.date]: event.target.value })
                  }
                />
              </label>
              <button type="submit" disabled={saving === point.date}>
                Save reader average
              </button>
            </form>
          </details>
        ))}
      </div>
      {pages > 1 && (
        <div className="solve-controls">
          <button
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Newer games
          </button>
          <span>
            Page {currentPage + 1} of {pages}
          </span>
          <button
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Older games
          </button>
        </div>
      )}
    </section>
  );
};

export default SolveAnalytics;
