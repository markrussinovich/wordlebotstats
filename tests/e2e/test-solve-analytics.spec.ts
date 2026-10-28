import { test, expect, chromium } from '@playwright/test';
import { createServer, Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let server: Server;
let origin: string;

test.beforeAll(async () => {
  const root = path.resolve(process.cwd(), 'dist');
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      const file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(`${root}${path.sep}`))
        throw new Error('Invalid path');
      const content = await readFile(file);
      const type = file.endsWith('.html')
        ? 'text/html'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/javascript';
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Security-Policy': "script-src 'self'; object-src 'self'",
      });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No test server address');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test('real solver worker, chart, tiles, reader persistence and cached reload work under extension CSP', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|worker/i.test(message.text())
    )
      errors.push(message.text());
  });
  await page.addInitScript(() => {
    const initial = [
      {
        date: '2026-10-24',
        attempts: 4,
        won: true,
        hardMode: false,
        solution: 'APPLE',
        nytReaderAverage: 4.2,
        nytReaderSource: 'wordlebot',
      },
      {
        date: '2026-10-25',
        attempts: 7,
        won: false,
        hardMode: true,
        solution: 'SLATE',
      },
      {
        date: '2026-10-26',
        attempts: null,
        won: false,
        hardMode: false,
        solution: 'ZZZZZ',
      },
    ];
    const get = () =>
      JSON.parse(localStorage.getItem('test-extension-storage') || '{}');
    const set = (values: Record<string, unknown>) =>
      localStorage.setItem(
        'test-extension-storage',
        JSON.stringify({ ...get(), ...values })
      );
    if (!get().games) set({ games: initial });
    (window as any).chrome = {
      runtime: {
        sendMessage: async (message: any) => {
          if (message.type === 'GET_DASHBOARD_DATA')
            return {
              success: true,
              games: get().games,
              benchmarks: [],
              preferences: {},
              timeFrames: ['all'],
            };
          if (message.type === 'IMPORT_GAME_RESULT') {
            set({
              games: get().games.map((game: any) =>
                game.date === message.gameResult.date
                  ? message.gameResult
                  : game
              ),
            });
            return { success: true };
          }
          return { success: true };
        },
        onMessage: { addListener() {}, removeListener() {} },
      },
      storage: {
        local: {
          get: async () => get(),
          set: async (values: Record<string, unknown>) => set(values),
        },
        sync: {
          get: async () => ({}),
          set: async () => undefined,
          remove: async () => undefined,
        },
      },
    };
  });
  await page.goto(`${origin}/dashboard.html#/analytics`);
  await expect(
    page.getByRole('heading', { name: /Solve analytics:/ })
  ).toBeVisible();
  await expect(
    page.getByText('Calculating solver paths in the background...')
  ).toBeHidden({ timeout: 60000 });
  const apple = page.locator('details').filter({ hasText: '2026-10-24' });
  await expect(apple.locator('summary')).toContainText('4.20');
  await apple.locator('summary').click();
  await expect(
    apple.getByLabel('Solver solution for 2026-10-24')
  ).toBeVisible();
  await expect(apple.locator('.solve-feedback').first()).toHaveAttribute(
    'aria-label',
    /^SLATE:/
  );
  await expect(apple.locator('.solve-feedback').last()).toHaveAttribute(
    'aria-label',
    /^APPLE: correct, correct, correct, correct, correct$/
  );
  const failed = page.locator('details').filter({ hasText: '2026-10-25' });
  await expect(failed.locator('summary')).toContainText('X/6');
  await expect(failed.locator('summary')).toContainText('N/A');
  await failed.locator('summary').click();
  await failed.getByLabel("NYT readers' average for 2026-10-25").fill('3.75');
  await failed.getByRole('button', { name: 'Save reader average' }).click();
  await expect(failed.locator('summary')).toContainText('3.75');
  await expect(failed.getByText(/user-entered from WordleBot/)).toBeVisible();
  await expect(page.locator('.solve-summary')).toContainText('2 matched games');
  const unknown = page.locator('details').filter({ hasText: '2026-10-26' });
  await unknown.locator('summary').click();
  await expect(
    unknown.getByText(/outside the bundled dictionary/)
  ).toBeVisible();
  await page.locator('.solve-controls select').last().selectOption('daily');
  await expect(page.locator('.solve-chart .recharts-line')).toHaveCount(3);
  const cached = await page.evaluate(() => {
    const storage = JSON.parse(
      localStorage.getItem('test-extension-storage') || '{}'
    );
    return Object.keys(storage).some((key) => key.startsWith('solver-'));
  });
  expect(cached).toBe(true);
  await page.reload();
  await expect(
    page.locator('details').filter({ hasText: '2026-10-25' }).locator('summary')
  ).toContainText('3.75');
  await expect(
    page.getByText('Calculating solver paths in the background...')
  ).toBeHidden();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Performance Timeline' })
  ).toBeVisible();
  await expect(page.locator('.solve-games details')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('popup preserves background responses, computes comparisons and keeps partial-import warnings compact', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 380, height: 600 });
  await page.addInitScript(() => {
    const listeners: any[] = [];
    const get = () =>
      JSON.parse(localStorage.getItem('popup-test-storage') || '{}');
    const set = (values: Record<string, unknown>) =>
      localStorage.setItem(
        'popup-test-storage',
        JSON.stringify({ ...get(), ...values })
      );
    if (!get().games)
      set({
        games: [
          {
            date: '2026-10-28',
            attempts: 4,
            won: true,
            solution: 'APPLE',
            skillScore: 88,
            luckScore: 51,
            nytReaderAverage: 4.2,
            guessPattern: [
              [...'SLATE'].map((letter) => ({ letter, status: 'absent' })),
              [...'APPLE'].map((letter) => ({ letter, status: 'correct' })),
            ],
          },
          { date: '2026-10-27', guesses: 1, won: true, solution: 'SLATE' },
          { date: '2026-10-26', attempts: 4, won: true, solution: 'ZZZZZ' },
          { date: '2026-10-25', attempts: 4, won: true },
        ],
      });
    (window as any).chrome = {
      runtime: {
        getURL: (file: string) => `${location.origin}/${file}`,
        sendMessage: async (message: any) => {
          if (message.type === 'GET_DASHBOARD_DATA')
            return { success: true, games: get().games };
          if (message.type === 'GET_QUICK_STATS')
            return {
              success: true,
              statistics: {
                winRate: 100,
                averageGuesses: 3,
                currentStreak: 4,
                maxStreak: 4,
                gameCount: 4,
              },
            };
          return { success: true };
        },
        onMessage: { addListener: (listener: any) => listeners.push(listener) },
      },
      storage: {
        local: {
          get: async () => get(),
          set: async (values: Record<string, unknown>) => set(values),
        },
      },
    };
    // Chrome accepts the first response from any extension listener, including resolved Promises.
    (window as any).deliverExternalMessage = (
      message: any,
      backgroundResponse = { success: true }
    ) => {
      const responses: Promise<any>[] = [
        new Promise((resolve) =>
          setTimeout(() => resolve(backgroundResponse), 25)
        ),
      ];
      for (const listener of listeners) {
        let respond: (value: any) => void = () => {};
        const callback = new Promise((resolve) => {
          respond = resolve;
        });
        const result = listener(message, {}, respond);
        if (result instanceof Promise)
          responses.push(result.then((value) => value ?? null));
        else if (result === true) responses.push(callback);
      }
      return Promise.race(responses);
    };
  });
  await page.goto(`${origin}/popup.html`);
  await expect(page.getByTestId('popup-reader-average')).toHaveText('4.20');
  const solver = page.getByRole('button', {
    name: 'Show local solver solution',
  });
  await expect(solver).toHaveText(/^[1-6]$/, { timeout: 60000 });
  const turns = await solver.textContent();

  for (const type of ['BULK_IMPORT_GAMES', 'GET_DASHBOARD_DATA']) {
    expect(
      await page.evaluate(
        async (type) =>
          (window as any).deliverExternalMessage(
            { type },
            { success: true, imported: 78, games: [{ date: '2026-10-28' }] }
          ),
        type
      )
    ).toMatchObject({
      success: true,
      imported: 78,
      games: [{ date: '2026-10-28' }],
    });
  }

  await solver.click();
  await expect(
    page.getByRole('region', { name: 'Local solver solution' })
  ).toContainText(/SLATE.*APPLE/);
  await expect(
    page.getByRole('region', { name: 'Local solver solution' })
  ).toContainText('not NYT WordleBot');
  await page.getByRole('button', { name: 'Previous game' }).click();
  await expect(page.getByTestId('popup-reader-average')).toHaveText('N/A');
  await expect(solver).toHaveText('1', { timeout: 60000 });
  await expect(page.locator('.board-row')).toHaveCount(6);
  await expect(
    page.getByRole('region', { name: 'Local solver solution' })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous game' }).click();
  await expect(solver).toHaveText('N/A', { timeout: 60000 });
  await expect(solver).toBeDisabled();
  await page.getByRole('button', { name: 'Previous game' }).click();
  await expect(solver).toHaveText('N/A');
  await expect(solver).toBeDisabled();
  await page.getByRole('button', { name: 'Next game' }).click();
  await page.getByRole('button', { name: 'Next game' }).click();
  await page.getByRole('button', { name: 'Next game' }).click();

  await page.evaluate(() =>
    (window as any).deliverExternalMessage({
      type: 'WORDLE_BOT_SCRAPE_COMPLETE',
      totalGames: 3,
      newGames: 1,
      duplicates: 0,
      errors: 2,
    })
  );
  const warning = page.getByRole('status');
  await expect(warning).toContainText('2 games could not be imported');
  expect((await warning.boundingBox())!.height).toBeLessThanOrEqual(46);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const dashboard = page.getByRole('button', {
    name: 'Dashboard',
    exact: true,
  });
  await dashboard.scrollIntoViewIfNeeded();
  await expect(dashboard).toBeInViewport();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(warning).toHaveCount(0);

  await page.evaluate(() =>
    (window as any).deliverExternalMessage({
      type: 'WORDLE_BOT_SCRAPE_COMPLETE',
      totalGames: 3,
      newGames: 0,
      duplicates: 0,
      errors: 3,
    })
  );
  await expect(page.getByRole('alert')).toContainText('History import failed');
  await page.evaluate(() =>
    (window as any).deliverExternalMessage({
      type: 'WORDLE_BOT_SCRAPE_ERROR',
      code: 'AUTH_REQUIRED',
      error: 'Please sign in.',
    })
  );
  await expect(page.getByRole('alert')).toContainText('Sign in required');
  await page.evaluate(() =>
    (window as any).deliverExternalMessage({
      type: 'WORDLE_BOT_SCRAPE_COMPLETE',
      totalGames: 3,
      newGames: 0,
      duplicates: 3,
      errors: 0,
    })
  );
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.waitForFunction(() => {
    const stored = JSON.parse(
      localStorage.getItem('popup-test-storage') || '{}'
    );
    return Object.entries(stored).some(
      ([key, value]) =>
        key.startsWith('solver-') &&
        (value as any).APPLE &&
        (value as any).SLATE &&
        (value as any).ZZZZZ
    );
  });
  await page.addInitScript(() => {
    (window as any).Worker = class {
      constructor() {
        throw new Error('Cached results should not start a worker');
      }
    };
  });
  await page.reload();
  await expect(solver).toHaveText(turns!);
  await expect(page.getByTestId('popup-reader-average')).toHaveText('4.20');
  expect(errors).toEqual([]);
});

test('real extension routes imports and dashboard replies correctly while its popup is open', async ({
  browserName,
}, testInfo) => {
  const extensionPath = path.resolve('dist');
  const manifest = JSON.parse(
    await readFile(path.join(extensionPath, 'manifest.json'), 'utf8')
  );
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    let background = context.serviceWorkers()[0];
    await expect
      .poll(async () => {
        for (const worker of context.serviceWorkers()) {
          if (
            (await worker
              .evaluate(() => chrome.runtime.getManifest().name)
              .catch(() => '')) === manifest.name
          ) {
            background = worker;
            return true;
          }
        }
        return false;
      })
      .toBe(true);
    await background.evaluate(() =>
      chrome.storage.local.set({
        games: [
          {
            date: '2026-10-28',
            attempts: 4,
            won: true,
            hardMode: false,
            solution: 'APPLE',
            nytReaderAverage: 4.2,
          },
        ],
      })
    );
    const url = new URL(background.url());
    const root = `${url.protocol}//${url.host}`;
    const popup = await context.newPage();
    await popup.goto(`${root}/popup.html`);
    await expect(popup.getByTestId('popup-reader-average')).toHaveText('4.20');
    const dashboard = await context.newPage();
    await dashboard.goto(`${root}/dashboard.html#/analytics`);
    await expect(
      dashboard.getByRole('heading', { name: /Solve analytics:/ })
    ).toBeVisible();
    const response = await dashboard.evaluate(() =>
      chrome.runtime.sendMessage({
        type: 'BULK_IMPORT_GAMES',
        games: [
          {
            date: '2026-10-29',
            attempts: 3,
            won: true,
            hardMode: false,
            solution: 'SLATE',
            nytReaderAverage: 3.9,
          },
        ],
      })
    );
    expect(response).toMatchObject({ success: true, imported: 1, errors: 0 });
    const data = await dashboard.evaluate(() =>
      chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_DATA' })
    );
    expect(data.games).toHaveLength(2);
    await dashboard.evaluate(() =>
      chrome.runtime.sendMessage({
        type: 'WORDLE_BOT_SCRAPE_COMPLETE',
        totalGames: 2,
        newGames: 1,
        duplicates: 1,
        errors: 0,
      })
    );
    await expect(popup.getByTestId('popup-reader-average')).toHaveText('3.90');
    await expect(popup.getByRole('alert')).toHaveCount(0);
    await expect(popup.getByRole('status')).toHaveCount(0);
    await expect(
      popup.getByRole('button', { name: 'Show local solver solution' })
    ).toHaveText('1');
  } finally {
    await context.close();
  }
});
