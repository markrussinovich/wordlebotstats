import { ExtensionStorage } from '@/extension/background/extensionStorage';
import { GameResult } from '@/types/gameTypes';
import { useGameDataStore } from '@/stores/gameData';

jest.mock('@/extension/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), error: jest.fn() },
}));

const game = (date: string, extra: Partial<GameResult> = {}): GameResult => ({
  date,
  attempts: 4,
  won: true,
  hardMode: false,
  ...extra,
});

describe('history persistence', () => {
  let stored: GameResult[];
  const storage = ExtensionStorage.getInstance();

  beforeEach(() => {
    stored = [];
    jest.clearAllMocks();
    (chrome.storage.local.get as jest.Mock).mockImplementation(async () => ({
      games: stored.map((item) => ({ ...item })),
    }));
    (chrome.storage.local.set as jest.Mock).mockImplementation(
      async (value) => {
        stored = value.games;
      }
    );
  });

  it('serializes simultaneous live captures and history imports without losing either', async () => {
    await Promise.all([
      storage.saveGame(game('2026-10-25')),
      storage.bulkImportGames([game('2026-10-26')]),
      storage.saveGame(game('2026-10-27')),
    ]);
    expect(stored.map((item) => item.date)).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });

  it('merges complementary fields and never erases a captured win with an empty card', async () => {
    const board = [[{ letter: 'A', status: 'correct' as const }]];
    await storage.saveGame(
      game('2026-10-25', {
        hardMode: true,
        guessPattern: board,
        skillScore: 80,
      })
    );
    await storage.bulkImportGames([
      game('2026-10-25', {
        attempts: null,
        won: false,
        solution: 'APPLE',
        nytReaderAverage: 4.12,
        guessPattern: [],
      }),
    ]);
    expect(stored[0]).toMatchObject({
      attempts: 4,
      won: true,
      hardMode: true,
      guessPattern: board,
      skillScore: 80,
      solution: 'APPLE',
      nytReaderAverage: 4.12,
    });
    const again = await storage.bulkImportGames([
      game('2026-10-25', {
        attempts: null,
        won: false,
        solution: 'APPLE',
        nytReaderAverage: 4.12,
        importedAt: 'new',
      }),
    ]);
    expect(again).toEqual({ imported: 0, duplicates: 1, errors: 0 });
  });

  it('does not replace all history with an empty array after a storage read error', async () => {
    stored = [game('2026-10-24')];
    (chrome.storage.local.get as jest.Mock).mockRejectedValueOnce(
      new Error('Read failed')
    );
    await expect(storage.saveGame(game('2026-10-25'))).rejects.toThrow(
      'Read failed'
    );
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    await storage.saveGame(game('2026-10-26'));
    expect(stored).toHaveLength(2);
  });

  it('serializes reader enrichment with imports and protects manual and mode-specific values', async () => {
    stored = [game('2026-10-28', { skillScore: 88 })];
    const readers = {
      nytReaderAverage: 4.2,
      nytReaderMode: 'hard' as const,
      nytReaderSource: 'wordlebot' as const,
    };
    await Promise.all([
      storage.updateReaderAverage('2026-10-28', readers, true),
      storage.bulkImportGames([game('2026-10-27')]),
    ]);
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      ...readers,
      hardMode: true,
      skillScore: 88,
      won: true,
      attempts: 4,
    });
    await storage.updateReaderAverage('2026-10-28', {
      ...readers,
      nytReaderMode: 'normal',
      nytReaderAverage: 3.8,
    });
    expect(stored[0].nytReaderAverage).toBe(4.2);
    await storage.saveGame({
      ...stored[0]!,
      nytReaderAverage: 4.3,
      nytReaderSource: 'manual',
    });
    await storage.updateReaderAverage('2026-10-28', readers);
    expect(stored[0]).toMatchObject({
      nytReaderAverage: 4.3,
      nytReaderSource: 'manual',
    });
  });

  it('keeps distinct games without optional IDs and enriches existing store entries', () => {
    useGameDataStore.getState().clearAllGames();
    useGameDataStore.getState().addGame(game('2026-10-24'));
    useGameDataStore
      .getState()
      .addGames([
        game('2026-10-25'),
        game('2026-10-25', { solution: 'APPLE' }),
      ]);
    useGameDataStore
      .getState()
      .addGame(game('2026-10-24', { nytReaderAverage: 4.2 }));
    expect(useGameDataStore.getState().games).toHaveLength(2);
    expect(useGameDataStore.getState().games[1].solution).toBe('APPLE');
    expect(useGameDataStore.getState().games[0].nytReaderAverage).toBe(4.2);
  });
});
