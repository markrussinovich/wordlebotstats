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
        skillScore: 88,
        luckScore: 51,
      },
      {
        date: '2026-10-25',
        attempts: 7,
        won: false,
        hardMode: true,
        solution: 'PENNY',
        skillScore: 90,
        luckScore: 0,
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
    if (!get().games)
      set({
        games: initial,
        'solver-2-dwyl-20f5cc9-slate-probes-exact8': {
          PENNY: { status: 'failed', turns: null, guesses: [] },
        },
      });
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
    /^RAISE:/
  );
  await expect(apple.locator('.solve-feedback').last()).toHaveAttribute(
    'aria-label',
    /^APPLE: correct, correct, correct, correct, correct$/
  );
  const failed = page.locator('details').filter({ hasText: '2026-10-25' });
  await expect(failed.locator('summary')).toContainText('X/6');
  await expect(failed.locator('summary')).toContainText('N/A');
  await expect(failed.locator('.solve-turns strong').nth(1)).toHaveText('3');
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
  await page.getByLabel('Timeline averaging').selectOption('daily');
  await expect(page.locator('.recharts-responsive-container')).toHaveCount(1);
  await expect(
    page.locator('.timeline-chart .recharts-line-curve')
  ).toHaveCount(3);
  const solverToggle = page.getByRole('button', {
    name: 'Local solver',
    exact: true,
  });
  await solverToggle.hover();
  await expect(page.locator('.metric-user .recharts-line-curve')).toHaveCSS(
    'stroke-opacity',
    '0.2'
  );
  await expect(page.locator('.metric-solver .recharts-line-curve')).toHaveCSS(
    'stroke-width',
    '4.5px'
  );
  await solverToggle.click();
  await expect(solverToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.metric-solver .recharts-line-curve')).toHaveCount(
    0
  );
  await solverToggle.click();
  for (const name of ['Skill', 'Luck']) {
    const toggle = page.getByRole('button', { name, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.focus();
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(
    page.locator('.timeline-chart .recharts-line-curve')
  ).toHaveCount(5);
  await expect(page.getByText('Score', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Game results', exact: true }).click();
  await expect(page.locator('.recharts-scatter')).toHaveCount(0);
  await page.getByLabel('Timeline averaging').selectOption('cumulative');
  await page.getByLabel('Timeline averaging').selectOption('trend');
  const selectRange = async (fraction: number) => {
    const endHandle = page.locator('.recharts-brush-traveller').last();
    await expect(endHandle.locator('.brush-grip-handle')).toHaveCSS('fill', 'rgb(106, 170, 100)');
    await expect(page.locator('.recharts-brush-slide')).not.toHaveCSS('fill', 'rgb(246, 247, 248)');
    await page
      .locator('.recharts-responsive-container')
      .scrollIntoViewIfNeeded();
    const start = (await page
      .locator('.recharts-brush-traveller')
      .first()
      .boundingBox())!;
    const end = (await endHandle.boundingBox())!;
    const y = end.y + end.height / 2;
    await page.mouse.move(end.x + end.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(
      start.x + (end.x - start.x) * fraction + end.width / 2,
      y,
      { steps: 8 }
    );
    await page.mouse.up();
  };
  await selectRange(0.5);
  await expect(page.locator('.solve-games details')).toHaveCount(2);
  await failed.getByRole('button', { name: 'Save reader average' }).click();
  await expect(page.locator('.solve-games details')).toHaveCount(2);
  await expect(page.locator('.solve-summary')).toContainText('2 matched games');
  await selectRange(0);
  await expect(page.locator('.solve-games details')).toHaveCount(1);
  await expect(
    page.locator('.chart-stats .chart-stat-value').first()
  ).toHaveText('1');
  await expect(
    page.locator('.metric-solver .recharts-line-dots circle')
  ).toHaveCount(1);
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
    page.getByRole('heading', { name: 'Wordle Stat Explorer', exact: true })
  ).toBeVisible();
  await expect(page.locator('.solve-games details')).toHaveCount(3);
  await selectRange(0.5);
  await expect(page.locator('.solve-games details')).toHaveCount(2);
  await failed.locator('summary').click();
  await failed.getByRole('button', { name: 'Save reader average' }).click();
  await expect(page.locator('.solve-games details')).toHaveCount(2);
  await expect(
    page.locator('.chart-stats .chart-stat-value').first()
  ).toHaveText('2');
  await page.reload();
  await expect(page.locator('.solve-games details')).toHaveCount(3);
  const overviewStats = page.locator('.stats-panel > .stat-item');
  await expect(overviewStats).toHaveCount(6);
  const statPositions = await overviewStats.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().y)
  );
  expect(new Set(statPositions).size).toBe(1);
  expect(
    (await page.locator('.dashboard-header').boundingBox())!.height
  ).toBeLessThan(90);
  expect(
    (await page.locator('.stats-panel').boundingBox())!.height
  ).toBeLessThan(90);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await expect(page.locator('.solve-games details')).toHaveCount(3);
    const styles = await page.evaluate(() => {
      const token = (name: string) => {
        const probe = document.createElement('span');
        probe.style.color = `var(${name})`;
        document.body.appendChild(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      const read = (selector: string) => {
        const style = getComputedStyle(document.querySelector(selector)!);
        return {
          font: style.fontFamily,
          background: style.backgroundColor,
          border: style.borderColor,
          radius: style.borderRadius,
          padding: style.padding,
        };
      };
      return {
        timeline: read('.chart-section:not(.solve-analytics)'),
        analytics: read('.solve-analytics'),
        overviewTile: read('.stats-panel .stat-item'),
        comparisonTile: read('.solve-summary .solve-tile'),
        gameTile: read('.solve-games .solve-tile'),
        tokens: {
          surface: token('--cp-surface'),
          text: token('--cp-text'),
          green: token('--cp-wordle-green'),
          tileText: token('--cp-wordle-fg'),
        },
        title: getComputedStyle(document.querySelector('.dashboard-header h1')!)
          .color,
        accent: token('--cp-accent'),
        boldness: getComputedStyle(document.querySelector('.stat-value')!)
          .fontWeight,
        text: getComputedStyle(document.querySelector('.stat-value')!).color,
        label: getComputedStyle(document.querySelector('.chart-stat-label')!)
          .color,
        chartSummary: read('.chart-stats'),
        userStroke: getComputedStyle(
          document.querySelector('.metric-user .recharts-line-curve')!
        ).stroke,
      };
    });
    expect(styles.analytics).toEqual(styles.timeline);
    expect(styles.comparisonTile).toEqual(styles.overviewTile);
    expect(styles.gameTile).toEqual(styles.overviewTile);
    expect(styles.overviewTile.background).toBe(styles.tokens.surface);
    expect(styles.overviewTile.font).toContain('Franklin');
    expect(styles.chartSummary.background).toBe(styles.tokens.green);
    expect(styles.text).toBe(styles.tokens.text);
    expect(styles.label).toBe(styles.tokens.tileText);
    expect(styles.userStroke).toBe(styles.tokens.green);
    expect(styles.title).toBe(styles.accent);
    expect(styles.accent).toBe('rgb(106, 170, 100)');
    expect(Number(styles.boldness)).toBeGreaterThanOrEqual(800);
  }
  await page.goto(`${origin}/dashboard.html?scoutTheme=light#/`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(overviewStats).toHaveCount(6);
  const mobileSize = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(mobileSize.width).toBeLessThanOrEqual(mobileSize.viewport);
  expect(
    (await page.locator('.stats-panel').boundingBox())!.height
  ).toBeLessThan(260);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const stored = JSON.parse(
      localStorage.getItem('test-extension-storage') || '{}'
    );
    stored.games = Array.from({ length: 25 }, (_, day) => ({
      date: `2026-09-${String(day + 1).padStart(2, '0')}`,
      attempts: 4,
      won: true,
      hardMode: false,
      solution: 'SLATE',
    }));
    localStorage.setItem('test-extension-storage', JSON.stringify(stored));
  });
  await page.reload();
  await expect(page.locator('.solve-games details')).toHaveCount(24);
  const older = page.getByRole('button', { name: 'Older games', exact: true });
  const newer = page.getByRole('button', { name: 'Newer games', exact: true });
  await expect(older).toHaveText('‹');
  await expect(newer).toHaveText('›');
  await expect(newer).toBeDisabled();
  await older.click();
  await expect(page.getByLabel('Game history pages')).toContainText(
    'Page 2 of 2'
  );
  await expect(page.locator('.solve-games details')).toHaveCount(1);
  await expect(page.locator('.solve-games summary')).toContainText(
    '2026-09-01'
  );
  await expect(older).toBeDisabled();
  expect((await older.boundingBox())!.x).toBeLessThan(
    (await newer.boundingBox())!.x
  );
  await newer.click();
  await expect(page.locator('.solve-games details')).toHaveCount(24);
  await expect(page.locator('.solve-games summary').first()).toContainText(
    '2026-09-25'
  );
  expect(errors).toEqual([]);
});

test('popup fits browser bounds, provides colored comparison buttons and keeps partial-import warnings compact', async ({
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
          { date: '2026-10-27', guesses: 1, won: true, solution: 'RAISE' },
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
  const solverValue = solver.locator('.score-value');
  await expect(solverValue).toHaveText(/^[1-6]$/, { timeout: 60000 });
  await expect(solver).toContainText('Solver');
  const turns = await solverValue.textContent();
  const dashboard = page.getByRole('button', {
    name: 'Dashboard',
    exact: true,
  });
  await expect(dashboard).toBeInViewport({ ratio: 1 });
  const popupSize = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
    viewportHeight: innerHeight,
    viewportWidth: innerWidth,
  }));
  expect(popupSize.height).toBeLessThanOrEqual(popupSize.viewportHeight);
  expect(popupSize.width).toBeLessThanOrEqual(popupSize.viewportWidth);
  const toggleBounds = (await solver.boundingBox())!;
  expect(toggleBounds.width).toBeGreaterThanOrEqual(44);
  expect(toggleBounds.height).toBeGreaterThanOrEqual(44);
  await expect(solver).toHaveCSS('border-top-style', 'solid');
  await expect(solver).toHaveCSS('border-top-width', '1px');
  const alignment = await page
    .locator('.board-and-scores')
    .evaluate((board) => {
      const positions = (selector: string) =>
        [...board.querySelectorAll(selector)].map((item) => ({
          label: item.querySelector('.score-label')!.getBoundingClientRect().y,
          value: item.querySelector('.score-value')!.getBoundingClientRect().y,
        }));
      return {
        left: positions('.comparison-scores .score-item'),
        right: positions(
          '.score-right-stacked:not(.comparison-scores) .score-item'
        ),
      };
    });
  expect(alignment.left).toHaveLength(2);
  expect(alignment.right).toHaveLength(2);
  alignment.left.forEach((position, index) => {
    expect(position.label).toBeCloseTo(alignment.right[index].label, 1);
    expect(position.value).toBeCloseTo(alignment.right[index].value, 1);
  });

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

  const userBoard = page.getByRole('group', { name: 'Your game board' });
  const userBoardMarkup = await userBoard.innerHTML();
  await solver.click();
  const solverBoard = page.getByRole('group', { name: 'Local solver board' });
  await expect(solverBoard).toBeVisible();
  await expect(
    page.getByText('Local solver (normal mode)', { exact: true })
  ).toBeVisible();
  await expect(solverBoard.locator('.board-row')).toHaveCount(6);
  expect(
    (
      await solverBoard
        .locator('.board-row')
        .first()
        .locator('.board-cell')
        .allTextContents()
    ).map((text) => text.trim())
  ).toEqual(['R', 'A', 'I', 'S', 'E']);
  const lastGuess = solverBoard.locator('.board-row').nth(Number(turns) - 1);
  expect(
    (await lastGuess.locator('.board-cell').allTextContents()).map((text) =>
      text.trim()
    )
  ).toEqual(['A', 'P', 'P', 'L', 'E']);
  await expect(lastGuess.locator('.board-cell-correct')).toHaveCount(5);
  await expect(
    page.locator('.comparison-scores .score-label').last()
  ).toHaveText('User');
  const userSwitch = page.getByRole('button', { name: 'Show your game' });
  await expect(userSwitch).toContainText('User');
  await expect(userSwitch.locator('.score-value')).toHaveText('4');
  await expect(dashboard).toBeInViewport({ ratio: 1 });
  await userSwitch.click();
  await expect(userBoard).toBeVisible();
  expect(await userBoard.innerHTML()).toBe(userBoardMarkup);
  await expect(
    page.locator('.comparison-scores .score-label').last()
  ).toHaveText('Solver');
  await expect(solverValue).toHaveText(turns!);
  await solver.click();
  await page.getByRole('button', { name: 'Previous game' }).click();
  await expect(page.getByTestId('popup-reader-average')).toHaveText('N/A');
  await expect(solverValue).toHaveText('1', { timeout: 60000 });
  await expect(solverValue).toHaveAttribute('data-comparison', 'tie');
  await expect(page.locator('.board-row')).toHaveCount(6);
  await expect(
    page.getByRole('group', { name: 'Local solver board' })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous game' }).click();
  await expect(solverValue).toHaveText('N/A', { timeout: 60000 });
  await expect(solverValue).toHaveAttribute('data-comparison', 'unavailable');
  await expect(solver).toBeDisabled();
  await page.getByRole('button', { name: 'Previous game' }).click();
  await expect(solverValue).toHaveText('N/A');
  await expect(solver).toBeDisabled();
  await page.getByRole('button', { name: 'Next game' }).click();
  await page.getByRole('button', { name: 'Jump to most recent game' }).click();
  await expect(page.getByTestId('popup-reader-average')).toHaveText('4.20');
  await expect(
    page.getByRole('button', { name: 'Jump to most recent game' })
  ).toHaveCount(0);

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
  await expect(dashboard).toBeInViewport({ ratio: 1 });
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
        (value as any).RAISE &&
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
  await expect(solverValue).toHaveText(turns!);
  await expect(page.getByTestId('popup-reader-average')).toHaveText('4.20');
  for (const comparison of [
    { attempts: 7, state: 'solver-better', color: 'rgb(211, 63, 73)' },
    { attempts: Number(turns), state: 'tie', color: 'rgb(106, 170, 100)' },
    { attempts: 1, state: 'user-better', color: 'rgb(59, 130, 196)' },
  ]) {
    await page.evaluate((attempts) => {
      const stored = JSON.parse(
        localStorage.getItem('popup-test-storage') || '{}'
      );
      stored.games[0].attempts = attempts;
      stored.games[0].won = attempts <= 6;
      localStorage.setItem('popup-test-storage', JSON.stringify(stored));
    }, comparison.attempts);
    await page.reload();
    await expect(solverValue).toHaveText(turns!);
    await expect(solverValue).toHaveAttribute(
      'data-comparison',
      comparison.state
    );
    await expect(solverValue).toHaveCSS('color', comparison.color);
    await solver.click();
    const userValue = page
      .getByRole('button', { name: 'Show your game' })
      .locator('.score-value');
    await expect(userValue).toHaveText(
      comparison.attempts === 7 ? 'X/6' : String(comparison.attempts)
    );
    await expect(userValue).toHaveAttribute(
      'data-comparison',
      comparison.state
    );
    await expect(userValue).toHaveCSS('color', comparison.color);
    await expect(dashboard).toBeInViewport({ ratio: 1 });
  }
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
            nytReaderSource: 'manual',
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
            nytReaderSource: 'manual',
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
      popup
        .getByRole('button', { name: 'Show local solver solution' })
        .locator('.score-value')
    ).toHaveText('3');
    await background.evaluate(() => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            botUserSteps: {
              normal: [0, 0, 0, 8, 2, 0, 0],
              hard: [0, 0, 0, 6, 4, 0, 0],
            },
          }),
          { status: 200 }
        );
    });
    await dashboard.evaluate(() =>
      chrome.runtime.sendMessage({
        type: 'BULK_IMPORT_GAMES',
        games: [
          {
            date: '2026-10-30',
            solution: 'GRIST',
            attempts: 4,
            won: true,
            hardMode: false,
            guessPattern: ['SLATE', 'GRIST'].map((word) =>
              [...word].map((letter) => ({ letter, status: 'correct' }))
            ),
          },
        ],
      })
    );
    const readerRequest = {
      type: 'GET_NYT_READER_AVERAGE',
      date: '2026-10-30',
      hardMode: true,
      words: ['SLATE', 'GRIST'],
    };
    expect(
      await dashboard.evaluate(
        (request) =>
          chrome.runtime.sendMessage({ ...request, words: ['GRIST'] }),
        readerRequest
      )
    ).toMatchObject({ success: false, game: null });
    expect(
      await dashboard.evaluate(
        (request) => chrome.runtime.sendMessage(request),
        readerRequest
      )
    ).toMatchObject({
      success: true,
      game: {
        hardMode: true,
        nytReaderMode: 'hard',
        nytReaderAverage: 4.4,
        attempts: 4,
      },
    });
    const stored = await dashboard.evaluate(() =>
      chrome.storage.local.get('games')
    );
    expect(stored.games).toHaveLength(3);
    expect(
      stored.games.find((game: any) => game.date === '2026-10-30')
    ).toMatchObject({ nytReaderAverage: 4.4, nytReaderSource: 'wordlebot' });
  } finally {
    await context.close();
  }
});
