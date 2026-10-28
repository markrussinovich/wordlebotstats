import { feedbackCells, scoreGuess, WordleSolver } from '@/solver/solver';
import {
  buildSolveComparison,
  comparisonTrend,
  pairedComparison,
} from '@/utils/solveComparison';
import { GameResult } from '@/types/gameTypes';

describe('local feedback solver', () => {
  const words = [
    'SLATE',
    'APPLE',
    'AMPLE',
    'MAPLE',
    'APPLY',
    'ALLEY',
    'CRANE',
    'CRATE',
    'TRACE',
  ];
  const solver = new WordleSolver(words);

  it('allocates duplicate letters once, with greens taking priority', () => {
    expect(
      feedbackCells('ALLEY', scoreGuess('ALLEY', 'APPLE')).map(
        (cell) => cell.status
      )
    ).toEqual(['correct', 'present', 'absent', 'present', 'absent']);
    expect(scoreGuess('APPLE', 'APPLE')).toBe(242);
  });

  it('uses only feedback to choose guesses, solves candidates, and does not inject unknown answers', () => {
    for (const word of words) {
      const result = solver.solve(word);
      expect(result.status).toBe('solved');
      expect(result.guesses[0].word).toBe('SLATE');
      expect(result.guesses[result.guesses.length - 1].word).toBe(word);
      let candidates = words;
      for (const guess of result.guesses) {
        const code = scoreGuess(guess.word, word);
        candidates = candidates.filter(
          (candidate) => scoreGuess(guess.word, candidate) === code
        );
        expect(guess.remaining).toBe(candidates.length);
      }
    }
    expect(solver.solve('ZZZZZ')).toEqual({
      status: 'unavailable',
      turns: null,
      guesses: [],
    });
    expect(solver.solve('SLATE').turns).toBe(1);
  });

  it('chooses the same next guess for indistinguishable histories', () => {
    const a = solver.solve('APPLE');
    const b = solver.solve('AMPLE');
    expect(scoreGuess('SLATE', 'APPLE')).toBe(scoreGuess('SLATE', 'AMPLE'));
    expect(a.guesses[1].word).toBe(b.guesses[1].word);
  });

  it('uses an information probe to minimize expected turns for an ambiguous endgame', () => {
    const answers = ['CATCH', 'HATCH', 'MATCH', 'PATCH', 'WATCH'];
    const probing = new WordleSolver([...answers, 'CHAMP', 'SLATE']);
    const paths = answers.map((answer) => probing.solve(answer));
    expect(paths.every((result) => result.status === 'solved')).toBe(true);
    // CHAMP separates this family; sequentially guessing its members costs more.
    expect(
      paths.some((result) =>
        result.guesses.some((guess) => guess.word === 'CHAMP')
      )
    ).toBe(true);
    expect(paths.reduce((sum, result) => sum + result.turns!, 0)).toBeLessThan(
      20
    );
  });
});

describe('solve comparisons', () => {
  const game = (date: string, extra: Partial<GameResult> = {}): GameResult => ({
    date,
    attempts: 4,
    won: true,
    hardMode: false,
    ...extra,
  });
  it('uses matching observations, excludes unplayed games and penalizes failures', () => {
    const points = buildSolveComparison(
      [
        game('2026-10-25', { nytReaderAverage: 4.2 }),
        game('2026-10-26', { attempts: 7, won: false }),
        game('2026-10-27', { attempts: null, won: false, nytReaderAverage: 3 }),
        game('2026-10-28', { nytReaderAverage: NaN }),
      ],
      {}
    );
    expect(pairedComparison(points, 'readers')).toMatchObject({
      count: 1,
      user: 4,
      benchmark: 4.2,
    });
    expect(points[1].user).toBe(7);
    expect(points[2].user).toBeNull();
    expect(pairedComparison(points, 'solver')).toBeNull();
    const trend = comparisonTrend(points);
    expect(trend[1].user).toBe(5.5);
    expect(trend[1].readers).toBeNull();
  });
  it('uses the same selected-range averaging for turns, solver, readers, skill and luck without inventing missing scores', () => {
    const points = buildSolveComparison(
      [
        game('2026-10-24', {
          solution: 'SLATE',
          skillScore: 80,
          luckScore: 0,
          nytReaderAverage: 4.2,
        }),
        game('2026-10-25', {
          solution: 'SLATE',
          attempts: 7,
          won: false,
          skillScore: 100,
          luckScore: NaN,
        }),
        game('2026-10-26', {
          solution: 'SLATE',
          attempts: 2,
          skillScore: 0,
          luckScore: 60,
          nytReaderAverage: 3.8,
        }),
      ],
      { SLATE: { status: 'solved', turns: 1, guesses: [] } }
    );
    const rolling = comparisonTrend(points, 2);
    expect(rolling[1].luck).toBeNull();
    expect(rolling[1].readers).toBeNull();
    expect(rolling[2]).toMatchObject({
      user: 4.5,
      solver: 1,
      readers: 3.8,
      skill: 50,
      luck: 60,
    });
    const cumulative = comparisonTrend(points, points.length);
    expect(cumulative[2]).toMatchObject({ readers: 4, skill: 60, luck: 30 });
    expect(cumulative[2].user).toBeCloseTo(13 / 3);
    expect(comparisonTrend(points.slice(2))[0]).toMatchObject({
      user: 2,
      solver: 1,
      readers: 3.8,
      skill: 0,
      luck: 60,
    });
  });
});
