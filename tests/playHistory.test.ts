import {
  buildGameHistory,
  gamesWithPlaySessions,
  hasUserGame,
} from '@/utils/playHistory';
import { GameResult } from '@/types/gameTypes';
import { PlaySession } from '@/types/playTypes';
import { PLAY_READER_AVERAGES_KEY, PLAY_SESSIONS_KEY } from '@/types/playTypes';
import { act, renderHook } from '@testing-library/react';
import { usePlayHistory } from '@/play/usePlayHistory';

it('includes blank records and missing dates only when unplayed games are enabled', () => {
  const games: GameResult[] = [
    { date: '2026-02-27', attempts: 3, won: true, hardMode: false },
    {
      date: '2026-03-01',
      attempts: null,
      completed: true,
      won: false,
      hardMode: false,
    },
    { date: '2026-03-02', attempts: 0, won: false, hardMode: false },
  ];
  expect(
    buildGameHistory(games, false, '2026-03-02').map((game) => game.date)
  ).toEqual(['2026-03-01', '2026-02-27']);
  const history = buildGameHistory(games, true, '2026-03-02');
  expect(history.map((game) => game.date)).toEqual([
    '2026-03-02',
    '2026-03-01',
    '2026-02-28',
    '2026-02-27',
  ]);
  expect(hasUserGame(history[1])).toBe(true);
  expect(hasUserGame(history[2])).toBe(false);
  expect(games).toHaveLength(3);
});

it('treats all-empty stored tiles as unplayed but never mistakes a win or loss without tiles for an unplayed game', () => {
  const blank: GameResult = {
    date: '2026-03-01',
    attempts: 0,
    won: false,
    hardMode: false,
    guessPattern: Array.from({ length: 6 }, () =>
      Array.from({ length: 5 }, () => ({ letter: '', status: 'absent' }))
    ),
  };
  expect(hasUserGame(blank)).toBe(false);
  expect(hasUserGame({ ...blank, won: true })).toBe(true);
  expect(hasUserGame({ ...blank, completed: true, attempts: null })).toBe(true);
});

it('shows completed local boards without changing imported games or enabling another play', () => {
  const date = '2026-03-01';
  const games: GameResult[] = [
    { date, attempts: 0, won: false, hardMode: false },
  ];
  const session: PlaySession = {
    date,
    mode: 'replay',
    rows: [[...'APPLE'].map((letter) => ({ letter, status: 'correct' }))],
    draft: '',
    status: 'won',
    answer: 'APPLE',
  };
  expect(
    buildGameHistory(
      gamesWithPlaySessions(games, { [date]: session }),
      false,
      date
    )[0]
  ).toMatchObject({
    attempts: 1,
    won: true,
    solution: 'APPLE',
    guessPattern: session.rows,
  });
  expect(games[0]).toMatchObject({ attempts: 0, won: false });
  const imported = { ...games[0], attempts: 4, won: true, solution: 'SLATE' };
  expect(gamesWithPlaySessions([imported], { [date]: session })).toEqual([
    imported,
  ]);
});

it('updates dashboard history on completion and reader events, survives remount, and prefers later imports', async () => {
  const date = '2026-03-01';
  const games: GameResult[] = [
    { date, attempts: 0, won: false, hardMode: false },
  ];
  const session: PlaySession = {
    date,
    mode: 'replay',
    rows: [[...'APPLE'].map((letter) => ({ letter, status: 'correct' }))],
    draft: '',
    status: 'playing',
    canPlay: false,
    answer: 'APPLE',
  };
  let stored: Record<string, unknown> = {
    [PLAY_SESSIONS_KEY]: { [date]: session },
  };
  const changed = { addListener: jest.fn(), removeListener: jest.fn() };
  chrome.storage.onChanged =
    changed as unknown as typeof chrome.storage.onChanged;
  (chrome.storage.local.get as jest.Mock).mockImplementation(
    async () => stored
  );
  const hook = renderHook(({ imports }) => usePlayHistory(imports), {
    initialProps: { imports: games },
  });
  await act(async () => {});
  expect(hook.result.current.displayGames).toEqual(games);
  expect(hook.result.current.history[0].attempts).toBe(1);
  const listener = changed.addListener.mock.calls[0][0];
  stored = { [PLAY_SESSIONS_KEY]: { [date]: { ...session, status: 'won' } } };
  act(() =>
    listener(
      {
        [PLAY_SESSIONS_KEY]: { newValue: stored[PLAY_SESSIONS_KEY] },
      },
      'local'
    )
  );
  expect(hook.result.current.displayGames[0]).toMatchObject({
    attempts: 1,
    won: true,
    completed: true,
    metadata: { extensionPlayMode: 'replay' },
  });
  const readers = {
    [date]: {
      nytReaderAverage: 3.2,
      nytReaderMode: 'normal',
      nytReaderSource: 'wordlebot',
    },
  };
  stored[PLAY_READER_AVERAGES_KEY] = readers;
  act(() =>
    listener(
      {
        [PLAY_READER_AVERAGES_KEY]: { newValue: readers },
      },
      'local'
    )
  );
  expect(hook.result.current.displayGames[0].nytReaderAverage).toBe(3.2);
  expect(games[0]).toEqual({ date, attempts: 0, won: false, hardMode: false });
  hook.unmount();
  expect(changed.removeListener).toHaveBeenCalledWith(listener);
  const restored = renderHook(({ imports }) => usePlayHistory(imports), {
    initialProps: { imports: games },
  });
  await act(async () => {});
  expect(restored.result.current.displayGames[0]).toMatchObject({
    attempts: 1,
    nytReaderAverage: 3.2,
  });
  const imported = { ...games[0], attempts: 4, won: true };
  restored.rerender({ imports: [imported] });
  expect(restored.result.current.displayGames).toEqual([imported]);
});
