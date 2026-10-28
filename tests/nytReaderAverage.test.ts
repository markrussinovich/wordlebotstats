import {
  fetchNytReaderAverage,
  parseNytReaderAverage,
} from '@/utils/nytReaderAverage';
import { GameResult } from '@/types/gameTypes';

describe('NYT per-puzzle reader averages', () => {
  const summary = {
    botUserSteps: {
      normal: [0, 0, 0, 9, 0, 0, 1],
      hard: [73, 4999, 30971, 48715, 34497, 12052, 942],
    },
    steps: { normal: [1, 0, 0, 0, 0, 0, 0] },
    average: { normal: 1, hard: 1 },
    unsolvedPenalty: { normal: 2, hard: 2.5 },
  };

  it('matches WordleBot reader distributions, modes, and failure penalties', () => {
    expect(parseNytReaderAverage(summary, false)).toEqual({
      nytReaderAverage: 4.5,
      nytReaderMode: 'normal',
      nytReaderSource: 'wordlebot',
    });
    expect(
      parseNytReaderAverage(summary, true)?.nytReaderAverage.toFixed(1)
    ).toBe('4.2');
    expect(
      parseNytReaderAverage({ steps: { normal: [0, 0, 0, 1, 0, 0, 0] } }, false)
    ).toMatchObject({ nytReaderAverage: 4 });
  });

  it('does not turn absent, malformed, or empty populations into averages', () => {
    for (const data of [
      null,
      {},
      { botUserSteps: { normal: [] } },
      { botUserSteps: { normal: [0, 0, 0, 0, 0, 0, 0] } },
      { botUserSteps: { normal: [0, 0, 0, -1, 0, 0, 1] } },
      { botUserSteps: { normal: [0, 0, 0, '10', 0, 0, 1] } },
      { ...summary, unsolvedPenalty: { normal: Infinity } },
    ])
      expect(parseNytReaderAverage(data, false)).toBeNull();
  });

  it('fetches anonymously by answer and date, caches both modes, and tolerates missing data', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => summary })
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('Offline'));
    globalThis.fetch = fetchMock;
    const game: GameResult = {
      date: '2026-10-28',
      solution: 'GRIST',
      hardMode: false,
      attempts: 4,
      won: true,
    };
    try {
      expect(await fetchNytReaderAverage(game)).toMatchObject({
        nytReaderAverage: 4.5,
      });
      expect(
        await fetchNytReaderAverage({ ...game, hardMode: true })
      ).toMatchObject({ nytReaderMode: 'hard' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://static01.nyt.com/newsgraphics/2022/wordlebot/grist-2026-10-28/summary.json',
        expect.objectContaining({
          credentials: 'omit',
          signal: expect.any(AbortSignal),
        })
      );
      expect(
        await fetchNytReaderAverage({ ...game, date: '2025-10-28' })
      ).toBeNull();
      expect(
        await fetchNytReaderAverage({ ...game, date: '2024-10-28' })
      ).toBeNull();
      expect(
        await fetchNytReaderAverage({ ...game, solution: '../GRIST' })
      ).toBeNull();
      expect(
        await fetchNytReaderAverage({ ...game, date: '2026-02-31' })
      ).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = original;
    }
  });
});
