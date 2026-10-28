import { GameResult } from '@/types/gameTypes';

export function mergeGames(
  existing: GameResult,
  incoming: GameResult
): GameResult {
  const defined = Object.fromEntries(
    Object.entries(incoming).filter(
      ([, value]) => value !== undefined && value !== null
    )
  );
  const merged = { ...existing, ...defined } as GameResult;

  // An incomplete history card must not erase a previously captured result or board.
  if (!incoming.attempts && existing.attempts) {
    merged.attempts = existing.attempts;
    merged.guesses = existing.guesses;
    merged.won = existing.won;
  }
  if (!incoming.guessPattern?.length && existing.guessPattern?.length) {
    merged.guessPattern = existing.guessPattern;
  }
  merged.hardMode = existing.hardMode || incoming.hardMode;
  return merged;
}
