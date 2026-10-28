import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameResult } from '@/types/gameTypes';
import { MessageType } from '@/types/messagingTypes';
import { SOLVER_DESCRIPTION } from '@/solver/solver';
import type { useSolver } from '../hooks/useSolver';
import { useGameDataStore } from '@/stores/gameData';
import {
  buildSolveComparison,
  compareTurns as comparison,
} from '@/utils/solveComparison';

interface Props {
  games: GameResult[];
  allGames?: GameResult[];
  solver: ReturnType<typeof useSolver>;
}

const formatTurns = (value: number | null) =>
  value === null
    ? 'N/A'
    : value === 7
      ? 'X/6'
      : value.toFixed(value % 1 ? 2 : 0);

const SolveAnalytics: React.FC<Props> = ({
  games,
  allGames = games,
  solver,
}) => {
  const { results, running, error } = solver;
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
  const [page, setPage] = useState(0);
  const points = useMemo(
    () => buildSolveComparison(games, results),
    [games, results]
  );
  const pages = Math.max(1, Math.ceil(points.length / 24));
  const currentPage = Math.min(page, pages - 1);
  const tiles = [...points]
    .reverse()
    .slice(currentPage * 24, (currentPage + 1) * 24);

  return (
    <section
      className="chart-section solve-analytics"
      aria-labelledby="solve-heading"
    >
      <h2 id="solve-heading" className="section-title">
        Individual games: you, NYT readers, and a local solver
      </h2>
      <p className="section-subtitle">
        Expand a tile to reveal the answer and the solver&apos;s actual guess
        sequence. Failures show as X/6; the solver uses normal mode even if you
        played hard mode.
      </p>
      <details className="solve-methodology">
        <summary>About the solver and NYT reader data</summary>
        <p>{SOLVER_DESCRIPTION}</p>
        <p>
          NYT reader averages load from WordleBot&apos;s per-puzzle summaries.
          Reader mode is shown in each game&apos;s details; normal mode is used
          when history does not identify a mode. Missing figures are N/A, never
          a national estimate.
        </p>
      </details>
      {running && (
        <p role="status">Calculating solver paths in the background...</p>
      )}
      {error && <p role="alert">{error}</p>}
      {!points.length && <p>No games in the selected range.</p>}
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
                  You <strong data-who="user">{formatTurns(point.user)}</strong>
                </span>
                <span>
                  Solver{' '}
                  <strong data-comparison={comparison(point.user, point.solver)}>
                    {!point.result && running
                      ? '...'
                      : formatTurns(point.solver)}
                  </strong>
                </span>
                <span>
                  NYT readers{' '}
                  <strong data-comparison={comparison(point.user, point.readers)}>
                    {formatTurns(point.readers)}
                  </strong>
                </span>
              </span>
            </summary>
            <h4>Answer: {point.game.solution || 'Unknown'}</h4>
            {point.result?.guesses.length ? (
              <div className="solve-path" aria-label={`Solver solution for ${point.date}`}>
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
                    <small>{guess.remaining} {guess.remaining === 1 ? 'candidate' : 'candidates'}</small>
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
          </details>
        ))}
      </div>
      {pages > 1 && (
        <nav className="solve-pagination" aria-label="Game history pages">
          <button
            className="time-nav-btn"
            aria-label="Older games"
            title="Older games"
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            &#8249;
          </button>
          <span aria-live="polite">
            Page {currentPage + 1} of {pages}
          </span>
          <button
            className="time-nav-btn"
            aria-label="Newer games"
            title="Newer games"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            &#8250;
          </button>
        </nav>
      )}
    </section>
  );
};

export default SolveAnalytics;
