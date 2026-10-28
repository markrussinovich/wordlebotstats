import { test, expect } from '@playwright/test';
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
