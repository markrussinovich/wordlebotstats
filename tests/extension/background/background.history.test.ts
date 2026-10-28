import { MessageType } from '@/types/messagingTypes';

jest.mock('@/extension/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), error: jest.fn() },
}));

describe('background history lifecycle', () => {
  let stored: Record<string, any>;
  let nextTab: number;
  let message: (value: any) => Promise<any>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    stored = {
      games: [{ date: '2026-10-27', attempts: 4, won: true, hardMode: false }],
    };
    nextTab = 1;
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };
    (chrome.runtime as any).onStartup = { addListener: jest.fn() };
    (chrome.runtime as any).getManifest = () => ({ version: '1.0.5' });
    (chrome as any).action = {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
    };
    (chrome.tabs as any).create = jest.fn(async () => ({ id: nextTab++ }));
    (chrome.tabs as any).remove = jest.fn(async () => undefined);
    (chrome.tabs as any).onRemoved = { addListener: jest.fn() };
    (chrome.tabs as any).onUpdated = { addListener: jest.fn() };
    (chrome.storage.local.get as jest.Mock).mockImplementation(async () => ({
      ...stored,
    }));
    (chrome.storage.local.set as jest.Mock).mockImplementation(
      async (value) => {
        Object.assign(stored, value);
      }
    );
    (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
      success: true,
    });
    await import('@/extension/background/background');
    const listener = (chrome.runtime.onMessage.addListener as jest.Mock).mock
      .calls[0][0];
    message = (value) => new Promise((resolve) => listener(value, {}, resolve));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not infer a newest-date cutoff and prevents overlapping imports', async () => {
    expect(
      await message({ type: MessageType.START_WORDLE_BOT_SCRAPE, mode: 'auto' })
    ).toMatchObject({ success: true });
    expect(stored.wordleBotScrapeParams).toMatchObject({
      mode: 'auto',
      maxIterations: 200,
    });
    expect(stored.wordleBotScrapeParams.stopAtDate).toBeUndefined();
    expect(
      await message({ type: MessageType.START_WORDLE_BOT_SCRAPE, mode: 'full' })
    ).toMatchObject({ skipped: true });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  it('old completion timers do not close a new scrape tab or reset its status', async () => {
    await message({ type: MessageType.START_WORDLE_BOT_SCRAPE, mode: 'full' });
    await message({
      type: MessageType.WORDLE_BOT_SCRAPE_COMPLETE,
      totalGames: 1,
      newGames: 1,
      duplicates: 0,
      errors: 0,
    });
    await message({ type: MessageType.START_WORDLE_BOT_SCRAPE, mode: 'auto' });
    await jest.advanceTimersByTimeAsync(5000);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
    expect(chrome.tabs.remove).not.toHaveBeenCalledWith(2);
    expect(stored.wordleBotScrapeStatus.phase).toBe('checking');
  });

  it('keeps failed batches visible as incomplete instead of claiming success', async () => {
    await message({ type: MessageType.START_WORDLE_BOT_SCRAPE, mode: 'full' });
    await message({
      type: MessageType.WORDLE_BOT_SCRAPE_COMPLETE,
      totalGames: 5,
      newGames: 2,
      duplicates: 0,
      errors: 3,
    });
    await jest.advanceTimersByTimeAsync(5000);
    expect(stored.wordleBotScrapeStatus.phase).toBe('error');
    expect(stored.scraperMetadata.lastScrapeMode).toBe('full');
    expect(stored.scraperMetadata.lastError).toContain('3');
  });
});
