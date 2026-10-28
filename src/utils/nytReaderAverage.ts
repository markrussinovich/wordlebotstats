import { GameResult } from '@/types/gameTypes';

export type NytReaderAverage = Required<
  Pick<GameResult, 'nytReaderAverage' | 'nytReaderMode'>
> & { nytReaderSource: 'wordlebot' };

export function parseNytReaderAverage(
  summary: any,
  hardMode: boolean
): NytReaderAverage | null {
  const mode = hardMode ? 'hard' : 'normal';
  const counts = (summary?.botUserSteps ?? summary?.steps)?.[mode];
  if (
    !Array.isArray(counts) ||
    counts.length !== 7 ||
    !counts.every((count) => Number.isSafeInteger(count) && count >= 0)
  )
    return null;
  const total = counts.reduce((sum, count) => sum + count, 0);
  const penalty = summary.unsolvedPenalty?.[mode] ?? 0;
  if (!total || !Number.isFinite(penalty) || penalty < 0) return null;
  // WordleBot uses its readers' distribution, with failures in bin seven.
  const average =
    (counts.reduce((sum, count, index) => sum + count * (index + 1), 0) +
      penalty) /
    total;
  if (!Number.isFinite(average) || average < 1 || average > 7) return null;
  return {
    nytReaderAverage: average,
    nytReaderMode: mode,
    nytReaderSource: 'wordlebot',
  };
}

const summaries = new Map<
  string,
  {
    expires: number;
    data: Promise<unknown>;
  }
>();

export async function fetchNytReaderAverage(
  game: GameResult
): Promise<NytReaderAverage | null> {
  const solution = game.solution?.trim().toLowerCase();
  if (
    !solution ||
    !/^[a-z]{5}$/.test(solution) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(game.date) ||
    !Number.isFinite(Date.parse(game.date)) ||
    new Date(game.date).toISOString().slice(0, 10) !== game.date
  )
    return null;
  const key = `${solution}-${game.date}`;
  let cached = summaries.get(key);
  if (!cached || cached.expires < Date.now()) {
    const data = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(
          `https://static01.nyt.com/newsgraphics/2022/wordlebot/${key}/summary.json`,
          { credentials: 'omit', signal: controller.signal }
        );
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })();
    cached = { expires: Date.now() + 5 * 60 * 1000, data };
    summaries.set(key, cached);
  }
  return parseNytReaderAverage(await cached.data, game.hardMode);
}
