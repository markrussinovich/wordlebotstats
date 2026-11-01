import { MessageType } from '@/types/messagingTypes';
import { PLAY_SESSIONS_KEY } from '@/types/playTypes';

jest.mock('@/extension/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), error: jest.fn() },
}));

describe('persistent extension play', () => {
  let stored: Record<string, any>;
  let play: typeof import('@/extension/background/playService').handlePlayMessage;
  const date = '2026-10-30';

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 31, 12));
    stored = {
      games: [
        { date, solution: 'APPLE', attempts: 0, won: false, hardMode: false },
        {
          date: '2026-10-31',
          solution: 'SLATE',
          attempts: 0,
          won: false,
          hardMode: false,
        },
        { date: '2026-10-29', attempts: 4, won: true, hardMode: false },
      ],
    };
    (chrome.storage.local.get as jest.Mock).mockImplementation(async () => ({
      ...stored,
    }));
    (chrome.storage.local.set as jest.Mock).mockImplementation(
      async (values) => {
        Object.assign(stored, values);
      }
    );
    (chrome.tabs.query as jest.Mock).mockResolvedValue([]);
    global.fetch = jest.fn();
    (chrome.tabs as any).create = jest.fn(async () => ({ id: 7 }));
    (chrome as any).windows = {
      create: jest.fn(async () => ({ id: 12 })),
      update: jest.fn(async () => ({})),
    };
    play = (await import('@/extension/background/playService'))
      .handlePlayMessage;
  });

  afterEach(() => jest.useRealTimers());

  it("offers unplayed dates and never exposes today's answer", async () => {
    expect(await play({ type: MessageType.GET_PLAY_CATALOG })).toMatchObject({
      today: '2026-10-31',
      dates: ['2026-10-31', date],
    });
    const response = await play({
      type: MessageType.GET_PLAY_SESSION,
      date: '2026-10-31',
    });
    expect(response.session).toMatchObject({ mode: 'live', rows: [] });
    expect(response.session.answer).toBeUndefined();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(
      (
        await play({
          type: MessageType.GET_PLAY_SESSION,
          date: '2026-10-29',
        })
      ).session.canPlay
    ).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      play({ type: MessageType.GET_PLAY_SESSION, date: '2026-11-01' })
    ).rejects.toThrow('Choose today');
  });

  it('scores duplicates, persists drafts and does not change imported stats', async () => {
    const original = JSON.stringify(stored.games);
    await play({
      type: MessageType.SAVE_PLAY_DRAFT,
      date,
      draft: 'papal',
      expectedRows: 0,
      client: 'popup',
    });
    expect(
      (await play({ type: MessageType.GET_PLAY_SESSION, date })).session.draft
    ).toBe('PAPAL');
    const response = await play({
      type: MessageType.SUBMIT_PLAY_GUESS,
      date,
      guess: 'PAPAL',
      expectedRows: 0,
    });
    expect(response.session.rows[0].map((cell: any) => cell.status)).toEqual([
      'present',
      'present',
      'correct',
      'absent',
      'present',
    ]);
    expect(response.session.draft).toBe('');
    expect(response.session.answer).toBeUndefined();
    expect(JSON.stringify(stored.games)).toBe(original);
    jest.resetModules();
    play = (await import('@/extension/background/playService'))
      .handlePlayMessage;
    expect(
      (await play({ type: MessageType.GET_PLAY_SESSION, date })).session.rows
    ).toHaveLength(1);
  });

  it('rejects invalid guesses and serializes simultaneous submissions from different surfaces', async () => {
    await expect(
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date,
        guess: 'ZZZZZ',
        expectedRows: 0,
      })
    ).resolves.toMatchObject({
      success: false,
      invalidGuess: true,
      error: 'Not in the replay word list.',
    });
    const results = await Promise.allSettled([
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date,
        guess: 'PAPAL',
        expectedRows: 0,
      }),
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date,
        guess: 'SLATE',
        expectedRows: 0,
      }),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(stored[PLAY_SESSIONS_KEY][date].rows).toHaveLength(1);
    await play({
      type: MessageType.SAVE_PLAY_DRAFT,
      date,
      draft: 'SLATE',
      expectedRows: 0,
    });
    expect(stored[PLAY_SESSIONS_KEY][date].draft).toBe('');
  });

  it('ends past games after winning or six guesses and prevents replaying finished games', async () => {
    const won = await play({
      type: MessageType.SUBMIT_PLAY_GUESS,
      date,
      guess: 'APPLE',
      expectedRows: 0,
    });
    expect(won.session).toMatchObject({ status: 'won', answer: 'APPLE' });
    await expect(
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date,
        guess: 'SLATE',
        expectedRows: 1,
      })
    ).rejects.toThrow('already finished');
    await expect(
      play({ type: MessageType.RESET_PLAY_REPLAY, date })
    ).rejects.toThrow('already finished');
    const otherDate = '2026-10-28';
    stored.games.push({
      date: otherDate,
      solution: 'APPLE',
      attempts: 0,
      won: false,
      hardMode: false,
    });
    for (let index = 0; index < 6; index++)
      await play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date: otherDate,
        guess: 'SLATE',
        expectedRows: index,
      });
    expect(stored[PLAY_SESSIONS_KEY][otherDate]).toMatchObject({
      status: 'lost',
      answer: 'APPLE',
    });
    await expect(
      play({ type: MessageType.RESET_PLAY_REPLAY, date: '2026-10-31' })
    ).rejects.toThrow('cannot be reset');
  });

  it('creates a background NYT tab and forwards official guesses without local scoring', async () => {
    const rows = [[...'SLATE'].map((letter) => ({ letter, status: 'absent' }))];
    (chrome.tabs.sendMessage as jest.Mock)
      .mockResolvedValueOnce({ success: true, rows: [] })
      .mockResolvedValueOnce({ success: true, rows });
    await play({ type: MessageType.CONNECT_NYT_PLAY, date: '2026-10-31' });
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ active: false })
    );
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 7 }]);
    const result = await play({
      type: MessageType.SUBMIT_PLAY_GUESS,
      date: '2026-10-31',
      guess: 'SLATE',
      expectedRows: 0,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(7, {
      type: MessageType.NYT_PLAY_GUESS,
      date: '2026-10-31',
      guess: 'SLATE',
      expectedRows: 0,
    });
    expect(result.session.rows).toEqual(rows);
    expect(result.session.answer).toBeUndefined();
  });

  it('synchronizes newer official rows on a rejected guess and does not create tabs while polling', async () => {
    await expect(
      play({
        type: MessageType.CONNECT_NYT_PLAY,
        date: '2026-10-31',
        poll: true,
      })
    ).rejects.toThrow('Connect');
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 7 }]);
    const rows = [[...'SLATE'].map((letter) => ({ letter, status: 'absent' }))];
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      success: false,
      rows,
      error: 'Board changed',
    });
    await expect(
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date: '2026-10-31',
        guess: 'APPLE',
        expectedRows: 0,
      })
    ).rejects.toThrow('Board changed');
    expect(stored[PLAY_SESSIONS_KEY]['2026-10-31'].rows).toEqual(rows);
  });

  it("opens a persistent pop-out and does not replay yesterday's existing NYT board", async () => {
    stored[PLAY_SESSIONS_KEY] = {
      [date]: {
        date,
        mode: 'live',
        rows: [[{ letter: 'A', status: 'correct' }]],
        draft: 'SLATE',
        status: 'playing',
      },
    };
    expect(
      (await play({ type: MessageType.GET_PLAY_SESSION, date })).session
    ).toMatchObject({
      mode: 'live',
      canPlay: false,
    });
    await play({ type: MessageType.OPEN_PLAY_WINDOW, date });
    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'popup',
        url: expect.stringContaining('popup.html?popout=1'),
      })
    );
    await play({ type: MessageType.OPEN_PLAY_WINDOW, date });
    expect(chrome.windows.create).toHaveBeenCalledTimes(1);
    expect(chrome.windows.update).toHaveBeenCalledWith(12, { focused: true });
  });

  it.each([
    { attempts: 4, won: true },
    { attempts: null, won: false, completed: true },
    { attempts: 0, won: false, guesses: 6 },
    {
      attempts: 0,
      won: false,
      guessPattern: [[{ letter: 'S', status: 'absent' }]],
    },
    { attempts: 0, won: false, guesses: ['SLATE'] },
  ])('rejects gameplay on an existing user game: %j', async (result) => {
    stored.games[0] = { date, hardMode: false, solution: 'APPLE', ...result };
    const session = (await play({ type: MessageType.GET_PLAY_SESSION, date }))
      .session;
    expect(session.canPlay).toBe(false);
    for (const type of [
      MessageType.SAVE_PLAY_DRAFT,
      MessageType.SUBMIT_PLAY_GUESS,
      MessageType.RESET_PLAY_REPLAY,
    ])
      await expect(
        play({ type, date, draft: 'SLATE', guess: 'SLATE', expectedRows: 0 })
      ).rejects.toThrow(/user game|already finished/);
    expect(fetch).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('disables an in-progress local game when a user game is imported later', async () => {
    await play({
      type: MessageType.SUBMIT_PLAY_GUESS,
      date,
      guess: 'PAPAL',
      expectedRows: 0,
    });
    stored.games[0] = { ...stored.games[0], attempts: 3, won: true };
    await expect(
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date,
        guess: 'SLATE',
        expectedRows: 1,
      })
    ).rejects.toThrow('already finished');
    expect(
      (await play({ type: MessageType.GET_PLAY_SESSION, date })).session.canPlay
    ).toBe(false);
    expect(stored[PLAY_SESSIONS_KEY][date].rows).toHaveLength(1);
  });

  it('fetches and caches answers only for missing past puzzles without adding user games', async () => {
    const missingDate = '2026-10-28';
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ print_date: missingDate, solution: 'apple' }),
    });
    const original = JSON.stringify(stored.games);
    await play({ type: MessageType.GET_PLAY_SESSION, date: missingDate });
    expect(fetch).not.toHaveBeenCalled();
    for (const [index, guess] of ['PAPAL', 'SLATE'].entries()) {
      const response = await play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date: missingDate,
        guess,
        expectedRows: index,
      });
      expect(response.session.answer).toBeUndefined();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `https://www.nytimes.com/svc/wordle/v2/${missingDate}.json`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(JSON.stringify(stored.games)).toBe(original);
  });

  it.each([
    { ok: false, json: async () => ({}) },
    {
      ok: true,
      json: async () => ({ print_date: '2026-10-27', solution: 'apple' }),
    },
    {
      ok: true,
      json: async () => ({ print_date: '2026-10-28', solution: 'invalid' }),
    },
  ])(
    'keeps the board unchanged if the past puzzle cannot be verified',
    async (response) => {
      (fetch as jest.Mock).mockResolvedValue(response);
      await expect(
        play({
          type: MessageType.SUBMIT_PLAY_GUESS,
          date: '2026-10-28',
          guess: 'SLATE',
          expectedRows: 0,
        })
      ).rejects.toThrow('Could not retrieve');
      expect(stored.wordlePastPuzzles).toBeUndefined();
      expect(stored[PLAY_SESSIONS_KEY]?.['2026-10-28']?.rows || []).toEqual([]);
    }
  );

  it('makes an already-started NYT board read-only instead of enabling replay or continuation', async () => {
    const rows = [[...'SLATE'].map((letter) => ({ letter, status: 'absent' }))];
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 7 }]);
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      success: true,
      rows,
    });
    const response = await play({
      type: MessageType.CONNECT_NYT_PLAY,
      date: '2026-10-31',
    });
    expect(response.session).toMatchObject({ rows, canPlay: false });
    await expect(
      play({
        type: MessageType.SUBMIT_PLAY_GUESS,
        date: '2026-10-31',
        guess: 'APPLE',
        expectedRows: 1,
      })
    ).rejects.toThrow('user game');
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
