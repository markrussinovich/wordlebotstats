import { GameResult } from '@/types/gameTypes';
import { SolverResult } from '@/solver/solver';

export function userTurns(game: GameResult): number | null {
  const attempts = game.attempts ?? game.guesses;
  if (!attempts || attempts < 1) return game.completed && !game.won ? 7 : null;
  return game.won && attempts <= 6 ? attempts : 7;
}

export function buildSolveComparison(
  games: GameResult[],
  results: Record<string, SolverResult>
) {
  return [...games]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((game) => {
      const result = results[game.solution?.trim().toUpperCase() || ''];
      const readers = game.nytReaderAverage;
      return {
        date: game.date,
        game,
        user: userTurns(game),
        solver: result?.status === 'failed' ? 7 : (result?.turns ?? null),
        readers:
          typeof readers === 'number' &&
          Number.isFinite(readers) &&
          readers >= 1 &&
          readers <= 7
            ? readers
            : null,
        skill: Number.isFinite(game.skillScore) ? game.skillScore! : null,
        luck: Number.isFinite(game.luckScore) ? game.luckScore! : null,
        result,
      };
    });
}

export type SolvePoint = ReturnType<typeof buildSolveComparison>[number];

// Matches the popup: red when the benchmark beats you, green for a tie, blue when you win.
export const compareTurns = (user: number | null, benchmark: number | null) =>
  user === null || benchmark === null
    ? undefined
    : Math.abs(user - benchmark) < 0.005
      ? 'tie'
      : benchmark < user
        ? 'benchmark-better'
        : 'user-better';

export function pairedComparison(
  points: SolvePoint[],
  reference: 'solver' | 'readers'
) {
  const paired = points.filter(
    (point) => point.user !== null && point[reference] !== null
  );
  if (!paired.length) return null;
  const user =
    paired.reduce((sum, point) => sum + point.user!, 0) / paired.length;
  const benchmark =
    paired.reduce((sum, point) => sum + point[reference]!, 0) / paired.length;
  return { count: paired.length, user, benchmark, delta: user - benchmark };
}

export function comparisonTrend(points: SolvePoint[], windowSize = 20) {
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - windowSize + 1), index + 1);
    const mean = (key: 'user' | 'solver' | 'readers' | 'skill' | 'luck') => {
      const available = window.filter((item) => item[key] !== null);
      return point[key] === null || !available.length
        ? null
        : available.reduce((sum, item) => sum + item[key]!, 0) /
            available.length;
    };
    return {
      ...point,
      user: mean('user'),
      solver: mean('solver'),
      readers: mean('readers'),
      skill: mean('skill'),
      luck: mean('luck'),
    };
  });
}
