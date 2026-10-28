import { WordleBotScraper } from '@/extension/content/wordleBotContent';
import { MessageType } from '@/types/messagingTypes';

jest.mock('@/extension/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), error: jest.fn() },
}));

const card = (date: string, solution = 'APPLE', reader = '') => `
  <div class="rating-container">
    <span class="date-label">${date}</span><strong class="solution">${solution}</strong>
    <div class="rating-right">${[80, 60, 4]
      .map(
        (value) =>
          `<div class="rating-value num"><span class="num">${value}</span></div>`
      )
      .join('')}</div>
    ${reader}
  </div>`;

describe('WordleBot history reconciliation', () => {
  let scraper: WordleBotScraper;
  let imported: any[];
  let messages: any[];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    document.body.innerHTML = '';
    imported = [];
    messages = [];
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      async (message) => {
        messages.push(message);
        if (message.type === 'BULK_IMPORT_GAMES') {
          imported.push(...message.games);
          return {
            success: true,
            imported: message.games.length,
            duplicates: 0,
            errors: 0,
          };
        }
        return { success: true };
      }
    );
    scraper = new WordleBotScraper();
    jest.spyOn(scraper as any, 'delay').mockResolvedValue(undefined);
    jest.spyOn(scraper as any, 'navigateToGameHistory').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads older pages to fill holes, and can scan the same DOM again', async () => {
    document.body.innerHTML = card('October 27, 2026');
    const more = jest
      .spyOn(scraper as any, 'loadMoreGames')
      .mockImplementationOnce(async () => {
        expect(imported.map((game) => game.date)).toEqual(['2026-10-27']);
        document.body.insertAdjacentHTML(
          'beforeend',
          card('October 25, 2026', 'CRANE')
        );
        return true;
      })
      .mockResolvedValue(false);
    await scraper.startScraping('auto');
    expect(imported.map((game) => game.date)).toEqual([
      '2026-10-27',
      '2026-10-25',
    ]);
    imported = [];
    more.mockResolvedValue(false);
    await scraper.startScraping('full');
    expect(imported).toHaveLength(2);
  });

  it('bounds empty-page retries instead of looping forever', async () => {
    await scraper.startScraping('full');
    expect(
      messages.some(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_ERROR
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_COMPLETE
      )
    ).toBe(false);
  });

  it('saves pages already read and reports a page-limit failure, not success', async () => {
    document.body.innerHTML = card('October 27, 2026');
    jest.spyOn(scraper as any, 'loadMoreGames').mockResolvedValue(true);
    await scraper.startScraping('full', undefined, 1);
    expect(imported).toHaveLength(1);
    expect(
      messages.find(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_ERROR
      )?.error
    ).toMatch(/page limit/);
    expect(
      messages.some(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_COMPLETE
      )
    ).toBe(false);
  });

  it('reports rejected import batches in the completion counts', async () => {
    document.body.innerHTML = card('October 27, 2026');
    jest.spyOn(scraper as any, 'loadMoreGames').mockResolvedValue(false);
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      async (message) => {
        messages.push(message);
        return { success: message.type !== 'BULK_IMPORT_GAMES' };
      }
    );
    await scraper.startScraping('full');
    expect(
      messages.find(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_COMPLETE
      )?.errors
    ).toBe(1);
  });

  it('ignores non-game rating rows while reporting malformed game cards', async () => {
    document.body.innerHTML =
      '<div class="rating-container">STEPS <span class="num">3.9</span></div>' +
      card('October 27, 2026') +
      '<div class="rating-container"><strong class="solution">CRANE</strong></div>';
    jest.spyOn(scraper as any, 'loadMoreGames').mockResolvedValue(false);
    await scraper.startScraping('full');
    expect(imported).toHaveLength(1);
    expect(
      messages.find(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_COMPLETE
      )
    ).toMatchObject({ totalGames: 1, newGames: 1, errors: 1 });
  });

  it('preserves explicit years and only captures explicitly labelled reader averages', async () => {
    document.body.innerHTML =
      card(
        'December 31, 2023',
        'APPLE',
        '<span class="nyt-reader-average">4.23</span>'
      ) + card('January 1, 2023', 'CRANE');
    jest.spyOn(scraper as any, 'loadMoreGames').mockResolvedValue(false);
    await scraper.startScraping('full');
    expect(imported[0]).toMatchObject({
      date: '2023-12-31',
      nytReaderAverage: 4.23,
      nytReaderSource: 'wordlebot',
    });
    expect(imported[1]).toMatchObject({ date: '2023-01-01' });
    expect(imported[1].nytReaderAverage).toBeUndefined();
  });

  it('does not consume visible cards during a newest-game probe', async () => {
    document.body.innerHTML = card('October 27, 2026');
    expect(await scraper.getNewestPageGame()).not.toBeNull();
    jest.spyOn(scraper as any, 'loadMoreGames').mockResolvedValue(false);
    await scraper.startScraping('auto');
    expect(imported).toHaveLength(1);
  });

  it('recognizes incorrect tiles as absent, not correct', () => {
    expect((scraper as any).normalizeTileStatus('incorrect')).toBe('absent');
  });

  it('captures the daily analysis mode with its puzzle and exact guesses, not recent-score aggregates', async () => {
    document.body.innerHTML = `
      <div id="g-wordle-results">
        Your Average Recent Score
        Average of 10 games in the past two weeks
        Based on my analysis of 132,249 hard mode Wordles
      </div>`;
    const pattern = ['SALET', 'FROST', 'WRIST', 'GRIST'].map((word) =>
      [...word].map((letter) => ({ letter, status: 'correct' }))
    );
    jest
      .spyOn(scraper as any, 'extractBoardVisual')
      .mockReturnValue({ pattern });
    await scraper.captureAnalysisMode();
    expect(messages).toHaveLength(0);
    document.querySelector('#g-wordle-results')!.innerHTML = `
      Your Ratings for Wordle No.<span>1,957</span>
      Based on my analysis of<span>132,249</span><span>hard mode </span>Wordles`;
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      async (message) => {
        messages.push(message);
        return { success: true, game: { date: '2026-10-28' } };
      }
    );
    await scraper.captureAnalysisMode();
    await scraper.captureAnalysisMode();
    expect(messages).toEqual([
      {
        type: MessageType.GET_NYT_READER_AVERAGE,
        date: '2026-10-28',
        hardMode: true,
        words: ['SALET', 'FROST', 'WRIST', 'GRIST'],
      },
    ]);
  });

  it('preserves partial history on stalled pagination and reports unreadable cards', async () => {
    document.body.innerHTML =
      card('October 27, 2026') +
      '<div class="rating-container"><strong class="solution">CRANE</strong></div>';
    jest
      .spyOn(scraper as any, 'loadMoreGames')
      .mockRejectedValue(new Error('Pagination stalled'));
    await scraper.startScraping('full');
    expect(imported).toHaveLength(1);
    expect(imported[0].date).toBe('2026-10-27');
    expect(
      messages.some(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_ERROR
      )
    ).toBe(true);

    messages = [];
    (scraper as any).loadMoreGames.mockResolvedValue(false);
    await scraper.startScraping('full');
    expect(
      messages.find(
        (message) => message.type === MessageType.WORDLE_BOT_SCRAPE_COMPLETE
      )?.errors
    ).toBe(1);
  });

  it('keeps yearless dates stable when pagination re-renders old DOM nodes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-03T12:00:00Z'));
    try {
      document.body.innerHTML = card('January 2');
      jest
        .spyOn(scraper as any, 'loadMoreGames')
        .mockImplementationOnce(async () => {
          document.body.innerHTML = card('January 2') + card('December 31');
          return true;
        })
        .mockResolvedValue(false);
      await scraper.startScraping('full');
      expect(imported.map((game) => game.date)).toEqual([
        '2026-01-02',
        '2025-12-31',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
});
