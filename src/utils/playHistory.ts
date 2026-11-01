import { GameResult } from '../types/gameTypes';
import {
  localPuzzleDate,
  PlayReaderAverage,
  PlaySession,
} from '../types/playTypes';

export const SHOW_UNPLAYED_KEY = 'wordleShowUnplayed';

export function hasUserGame(game?: GameResult): boolean {
  if (!game) return false;
  const guesses = game.guesses as unknown;
  return Boolean(
    game.won ||
      game.completed ||
      (typeof game.attempts === 'number' && game.attempts > 0) ||
      (typeof guesses === 'number' && guesses > 0) ||
      game.guessPattern?.some((row) =>
        row.some((cell) => Boolean(cell.letter?.trim()))
      ) ||
      (Array.isArray(guesses) &&
        guesses.some((row) =>
          typeof row === 'string'
            ? Boolean(row.trim())
            : Array.isArray(row) &&
              row.some((cell) =>
                typeof cell === 'string'
                  ? Boolean(cell.trim())
                  : Boolean(cell?.letter || cell?.value)
              )
        ))
  );
}

export function gamesWithPlaySessions(
  games: GameResult[],
  sessions: Record<string, PlaySession>,
  readers: Record<string, PlayReaderAverage> = {}
): GameResult[] {
  const byDate = new Map(games.map((game) => [game.date, game]));
  for (const session of Object.values(sessions)) {
    if (
      hasUserGame(byDate.get(session.date)) ||
      !session.rows.length ||
      (session.status === 'playing' && session.canPlay !== false)
    )
      continue;
    byDate.set(session.date, {
      ...byDate.get(session.date),
      date: session.date,
      attempts: session.rows.length,
      won: session.status === 'won',
      completed: session.status !== 'playing',
      hardMode: false,
      guessPattern: session.rows,
      solution:
        session.answer ||
        (session.status === 'won'
          ? session.rows[session.rows.length - 1]
              ?.map((cell) => cell.letter)
              .join('')
          : undefined),
      ...(byDate.get(session.date)?.nytReaderSource === 'manual'
        ? {}
        : readers[session.date]),
      metadata: {
        ...byDate.get(session.date)?.metadata,
        extensionPlayMode: session.mode,
      },
    });
  }
  return [...byDate.values()];
}

export function buildGameHistory(
  games: GameResult[],
  showUnplayed: boolean,
  today = localPuzzleDate()
): GameResult[] {
  const byDate = new Map(
    games
      .filter(
        (game) =>
          /^\d{4}-\d{2}-\d{2}$/.test(game.date) &&
          Number.isFinite(Date.parse(game.date)) &&
          new Date(game.date).toISOString().slice(0, 10) === game.date &&
          game.date >= '2021-06-19' &&
          game.date <= today
      )
      .map((game) => [game.date, game])
  );
  if (showUnplayed) {
    const start = [...byDate.keys()].sort()[0] || today;
    const cursor = new Date(`${start}T12:00:00Z`);
    while (cursor.toISOString().slice(0, 10) <= today) {
      const date = cursor.toISOString().slice(0, 10);
      if (!byDate.has(date))
        byDate.set(date, { date, attempts: 0, won: false, hardMode: false });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return [...byDate.values()]
    .filter((game) => showUnplayed || hasUserGame(game))
    .sort((a, b) => b.date.localeCompare(a.date));
}
