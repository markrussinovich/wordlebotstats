import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
} from '@playwright/test';
import path from 'node:path';

async function backgroundWorker(context: BrowserContext): Promise<Worker> {
  let background: Worker | undefined;
  await expect
    .poll(
      async () => {
        for (const worker of context.serviceWorkers()) {
          if (
            (await worker
              .evaluate(() => chrome.runtime.getManifest().name)
              .catch(() => '')) === 'Wordle Companion — Play & Stats'
          ) {
            background = worker;
            return true;
          }
        }
        return false;
      },
      { timeout: 15000 }
    )
    .toBe(true);
  return background!;
}

test('opening unplayed dashboard tiles routes typing to the selected board', async ({
  browserName,
}, testInfo) => {
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const dates = await background.evaluate(async () => {
      const dates = [1, 2].map((days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });
      await chrome.storage.local.set({
        wordleShowUnplayed: true,
        games: dates.map((date) => ({
          date,
          solution: 'PLANT',
          attempts: 0,
          won: false,
          nytReaderSource: 'manual',
        })),
      });
      return dates;
    });
    const root = background.url().replace(/\/background\.js.*$/, '');
    const dashboard = await context.newPage();
    await dashboard.goto(`${root}/dashboard.html`);
    for (const [index, date] of dates.entries()) {
      const summary = dashboard.locator('.solve-tile summary').filter({
        hasText: date,
      });
      if (index === 0) {
        await summary.locator('span').first().click();
      } else {
        await summary.focus();
        await background.evaluate(async (date) => {
          const stored = await chrome.storage.local.get('wordlePlaySessions');
          const sessions = stored.wordlePlaySessions;
          sessions[date].draft = 'PLA';
          sessions[date].draftClient = 'another-view';
          await chrome.storage.local.set({ wordlePlaySessions: sessions });
        }, dates[0]);
        await expect(
          dashboard
            .frameLocator(`iframe[title="Play Wordle ${dates[0]}"]`)
            .locator('.board-row')
            .first()
            .locator('.board-cell')
        ).toHaveText(['P', 'L', 'A', '', '']);
        await expect(summary).toBeFocused();
        await dashboard.keyboard.press('Enter');
      }
      const game = dashboard.frameLocator(
        `iframe[title="Play Wordle ${date}"]`
      );
      await expect(game.locator('#popup-game-board')).toHaveAttribute(
        'aria-busy',
        'false'
      );
      await expect(game.locator('#popup-game-board')).toBeFocused();
      await expect
        .poll(() =>
          dashboard.evaluate(
            (date) =>
              document.activeElement ===
              document.querySelector(`iframe[title="Play Wordle ${date}"]`),
            date
          )
        )
        .toBe(true);
      await dashboard.keyboard.type('PL', { delay: 30 });
      await expect(
        game.locator('.board-row').first().locator('.board-cell')
      ).toHaveText(['P', 'L', '', '', '']);
    }
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('dashboard play page focuses its iframe on entry and puzzle changes', async ({
  browserName,
}, testInfo) => {
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const dates = await background.evaluate(async () => {
      const dates = [1, 2].map((days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });
      await chrome.storage.local.set({
        wordleShowUnplayed: true,
        wordlePlaySelection: dates[0],
        games: dates.map((date) => ({
          date,
          solution: 'PLANT',
          attempts: 0,
          won: false,
          nytReaderSource: 'manual',
        })),
      });
      return dates;
    });
    const root = background.url().replace(/\/background\.js.*$/, '');
    const dashboard = await context.newPage();
    await dashboard.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (
          event.origin === window.location.origin &&
          event.data?.type === 'WORDLE_PLAY_READY'
        ) {
          // Simulate parent focus being restored as the child finishes loading.
          document
            .querySelector<HTMLIFrameElement>('iframe[title="Play Wordle"]')
            ?.blur();
        }
      });
    });
    await dashboard.goto(`${root}/dashboard.html`);
    await dashboard
      .getByRole('link', { name: 'Play Wordle', exact: true })
      .click();
    const game = dashboard.frameLocator('iframe[title="Play Wordle"]');
    const board = game.getByRole('group', {
      name: 'Wordle board',
      exact: true,
    });
    const picker = game.getByRole('combobox', { name: 'Puzzle' });
    const expectKeyboardFocus = async () => {
      await expect(board).toHaveAttribute('data-ready', 'true');
      await expect(board).toBeFocused();
      await expect
        .poll(() =>
          dashboard.evaluate(
            () =>
              document.activeElement ===
              document.querySelector('iframe[title="Play Wordle"]')
          )
        )
        .toBe(true);
    };
    await expect(picker).toHaveValue(dates[0]);
    await expectKeyboardFocus();
    await dashboard.keyboard.type('PL', { delay: 30 });
    await expect(
      board.locator('.play-row').first().locator('.play-cell')
    ).toHaveText(['P', 'L', '', '', '']);
    await picker.click();
    await dashboard.keyboard.press('ArrowDown');
    await dashboard.keyboard.press('Enter');
    await expect(picker).toHaveValue(dates[1]);
    await expect(board).toHaveAttribute('data-date', dates[1]);
    await expectKeyboardFocus();
    await dashboard.keyboard.type('CR', { delay: 30 });
    await expect(
      board.locator('.play-row').first().locator('.play-cell')
    ).toHaveText(['C', 'R', '', '', '']);
    await dashboard.goto(`${root}/dashboard.html#/play/${dates[0]}`);
    await expect(picker).toHaveValue(dates[0]);
    await expectKeyboardFocus();
    await dashboard.keyboard.type('A');
    await expect(
      board.locator('.play-row').first().locator('.play-cell')
    ).toHaveText(['P', 'L', 'A', '', '']);
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('submissions keep boards stationary and solved replays show completed comparisons', async ({
  browserName,
}, testInfo) => {
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const date = await background.evaluate(async () => {
      const day = (offset: number) => {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      const date = day(1);
      await chrome.storage.local.set({
        games: [
          {
            date: day(3),
            solution: 'PLANT',
            attempts: 1,
            won: true,
            hardMode: false,
            nytReaderSource: 'manual',
            nytReaderAverage: 3.2,
          },
        ],
        wordleShowUnplayed: true,
        wordlePastPuzzles: { [date]: { print_date: date, solution: 'PLANT' } },
      });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (
          url.startsWith('https://static01.nyt.com/') &&
          url.endsWith('/summary.json')
        )
          return new Response(
            JSON.stringify({
              botUserSteps: { normal: [0, 0, 80, 20, 0, 0, 0] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        return originalFetch(input, init);
      };
      return date;
    });
    const root = background.url().replace(/\/background\.js.*$/, '');
    const popup = await context.newPage();
    await popup.goto(`${root}/popup.html?date=${date}`);
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'data-ready',
      'true'
    );
    const popupBounds = await popup.locator('#popup-game-board').boundingBox();
    const timeline = await context.newPage();
    await timeline.goto(`${root}/dashboard.html#/analytics`);
    await timeline.getByLabel('Timeline averaging').selectOption('daily');
    await expect(timeline.locator('.chart-stat-value').first()).toHaveText('1');
    await expect(
      timeline.locator('.metric-user .recharts-line-dots circle')
    ).toHaveCount(1);
    const dashboard = await context.newPage();
    await dashboard.goto(`${root}/dashboard.html#/play/${date}`);
    const game = dashboard.frameLocator('iframe[title="Play Wordle"]');
    const board = game.locator('.play-board');
    await expect(board).toHaveAttribute('data-ready', 'true');
    await game.locator('.wordle-play').evaluate((main) => {
      const box = main.querySelector('.play-board')!.getBoundingClientRect();
      const baseline = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
      const observer = new MutationObserver(() => {
        const box = main.querySelector('.play-board')!.getBoundingClientRect();
        if (
          Object.entries(baseline).some(
            ([key, value]) =>
              Math.abs(box[key as keyof typeof baseline] - value) > 1
          )
        )
          (main as HTMLElement).dataset.boardShifted = 'true';
      });
      observer.observe(main, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    });
    const bounds = await board.boundingBox();
    const bottom = await game.locator('.play-bottom').boundingBox();
    for (const guess of ['SLATE', 'PLANT']) {
      await expect(board).toHaveAttribute('data-ready', 'true');
      await dashboard.keyboard.type(guess, { delay: 30 });
      await dashboard.keyboard.press('Enter');
      await expect(board).toHaveAttribute('data-ready', 'true');
      const row = guess === 'SLATE' ? 0 : 1;
      await expect(
        board.locator('.play-row').nth(row).locator('[data-state="tbd"]')
      ).toHaveCount(0);
      expect(await board.boundingBox()).toEqual(bounds);
    }
    const summary = game.getByRole('region', {
      name: 'Completed game comparisons',
    });
    await expect(
      summary.getByText('You', { exact: true }).locator('..')
    ).toContainText('2');
    await expect(
      summary.getByText('NYT readers', { exact: true }).locator('..')
    ).toContainText('3.20');
    await expect(
      summary.getByText('Local solver', { exact: true }).locator('..')
    ).toContainText(/[1-6]/);
    await expect(game.locator('.play-keyboard')).toBeHidden();
    expect(await game.locator('.play-bottom').boundingBox()).toEqual(bottom);
    await expect(game.locator('.wordle-play')).not.toHaveAttribute(
      'data-board-shifted',
      'true'
    );
    await expect(popup.locator('#popup-play-controls')).toHaveCount(0);
    await expect(
      popup.locator('[data-testid="popup-reader-average"]')
    ).toHaveText('3.20');
    expect(await popup.locator('#popup-game-board').boundingBox()).toEqual(
      popupBounds
    );
    const records = await background.evaluate(async () => {
      return (await chrome.storage.local.get('games')).games;
    });
    expect(records).toHaveLength(1);
    expect(records.some((game: { date: string }) => game.date === date)).toBe(
      false
    );
    await expect(timeline.locator('.chart-stat-value').first()).toHaveText('2');
    await expect(
      timeline.locator('.metric-user .recharts-line-dots circle')
    ).toHaveCount(2);
    const assertReplayTooltip = async () => {
      await timeline
        .locator('.metric-user .recharts-line-dots circle')
        .last()
        .hover({ force: true });
      const tooltip = timeline.locator('.chart-tooltip');
      await expect(
        tooltip.getByText('Local replay', { exact: true })
      ).toBeVisible();
      await expect(tooltip.locator('.tooltip-word')).toHaveText('PLANT');
      await expect(tooltip.locator('.tooltip-comparisons')).toContainText(
        '2.00'
      );
      await expect(tooltip.locator('.tooltip-comparisons')).toContainText(
        '3.20'
      );
      await expect(tooltip).not.toContainText('No game recorded');
    };
    await assertReplayTooltip();
    for (const route of ['#/analytics', '']) {
      await timeline.goto(`${root}/dashboard.html${route}`);
      await timeline.getByLabel('Timeline averaging').selectOption('daily');
      await expect(timeline.locator('.chart-stat-value').first()).toHaveText(
        '2'
      );
      await expect(
        timeline.locator('.metric-user .recharts-line-dots circle')
      ).toHaveCount(2);
      await assertReplayTooltip();
      if (!route)
        await expect(
          timeline.locator('.stats-panel .stat-value').first()
        ).toHaveText('2');
    }
    await dashboard.reload();
    await expect(
      summary.getByText('NYT readers', { exact: true }).locator('..')
    ).toContainText('3.20');
    await expect(game.locator('.play-keyboard')).toBeHidden();
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('played and unplayed popup boards keep the same geometry and navigation positions', async ({
  browserName,
}, testInfo) => {
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const dates = await background.evaluate(async () => {
      const dates = [1, 2, 3].map((days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });
      await chrome.storage.local.set({
        wordleShowUnplayed: true,
        games: dates.map((date, index) => ({
          date,
          solution: 'PLANT',
          attempts: index ? 0 : 1,
          won: index === 0,
          skillScore: 95,
          luckScore: 50,
          nytReaderAverage: 3.8,
          nytReaderSource: 'manual',
          guessPattern: index
            ? []
            : [[...'PLANT'].map((letter) => ({ letter, status: 'correct' }))],
        })),
      });
      return dates;
    });
    const root = background.url().replace(/\/background\.js.*$/, '');
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 580 });
    await popup.goto(`${root}/popup.html?date=${dates[0]}`);
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'data-date',
      dates[0]
    );
    await expect(popup.locator('.stats-grid')).toBeVisible();
    const footerGap = await popup.evaluate(() => {
      const cards = document.querySelectorAll('.stat-card');
      const last = cards[cards.length - 1]?.getBoundingClientRect();
      const footer = document
        .querySelector('.popup-footer')
        ?.getBoundingClientRect();
      return last && footer
        ? footer.top - last.bottom
        : Number.POSITIVE_INFINITY;
    });
    expect(footerGap).toBeGreaterThanOrEqual(0);
    expect(footerGap).toBeLessThanOrEqual(4);
    const geometry = () =>
      popup.evaluate(() => {
        return [
          'popup-game-board',
          'prev-game-btn',
          'next-game-btn',
          'latest-game-btn',
        ].map((id) => {
          const box = document.getElementById(id)!.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        });
      });
    const played = await geometry();
    await popup
      .getByRole('button', { name: 'Previous game', exact: true })
      .click();
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'data-date',
      dates[1]
    );
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'aria-busy',
      'false'
    );
    const unplayed = await geometry();
    for (let index = 0; index < played.length; index++) {
      for (const property of ['x', 'y', 'width', 'height'] as const)
        expect(
          Math.abs(played[index][property] - unplayed[index][property]),
          `element ${index} ${property}`
        ).toBeLessThanOrEqual(1);
    }
    await popup.getByRole('button', { name: 'Next game', exact: true }).click();
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'data-date',
      dates[0]
    );
    expect(await geometry()).toEqual(played);
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('selecting another unplayed puzzle restores board focus and direct typing', async ({
  browserName,
}, testInfo) => {
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const dates = await background.evaluate(async () => {
      const dates = [1, 2].map((days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });
      await chrome.storage.local.set({
        wordleShowUnplayed: true,
        games: dates.map((date, index) => ({
          date,
          solution: index ? 'SLATE' : 'APPLE',
          attempts: 0,
          won: false,
          nytReaderSource: 'manual',
        })),
      });
      return dates;
    });
    const root = background.url().replace(/\/background\.js.*$/, '');
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${root}/play.html?date=${dates[0]}`);
    const picker = page.getByRole('combobox', { name: 'Puzzle' });
    const board = page.getByRole('group', { name: 'Wordle board' });
    await expect(picker).toBeEnabled();
    await expect(board).toHaveAttribute('data-date', dates[0]);
    await picker.click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(picker).toHaveValue(dates[1]);
    await expect(board).toHaveAttribute('data-date', dates[1]);
    await expect(board).toBeFocused();
    await page.keyboard.type('C');
    const typedCell = board.locator('.play-cell').first();
    await expect
      .poll(() =>
        typedCell.evaluate((cell) =>
          cell
            .getAnimations()
            .some((animation) => animation.id === 'wordle-letter-pop')
        )
      )
      .toBe(true);
    const typedSize = await typedCell.evaluate((cell) => {
      const animation = cell
        .getAnimations()
        .find((animation) => animation.id === 'wordle-letter-pop')!;
      animation.pause();
      animation.currentTime = 50;
      const size = {
        animated: cell.getBoundingClientRect().width,
        normal: (cell as HTMLElement).offsetWidth,
      };
      animation.finish();
      return size;
    });
    expect(typedSize.animated).toBeGreaterThan(typedSize.normal);
    await page.keyboard.type('R');
    await expect(board.locator('.play-row').first()).toHaveText('CR');
    await picker.focus();
    await picker.selectOption(dates[0]);
    await expect(board).toHaveAttribute('data-date', dates[0]);
    await expect(board).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.type('SL');
    await expect(board.locator('.play-row').first()).toHaveText('SL');
    expect(
      await board
        .locator('.play-cell')
        .first()
        .evaluate((cell) =>
          cell
            .getAnimations()
            .some((animation) => animation.id === 'wordle-letter-pop')
        )
    ).toBe(false);
    await page.close();
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('real replay stays synchronized in popup, dashboard and persistent pop-out', async ({
  browserName,
}, testInfo) => {
  test.setTimeout(90000);
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const date = await background.evaluate(async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      await chrome.storage.local.set({
        games: [
          {
            date,
            solution: 'APPLE',
            attempts: 0,
            won: false,
            hardMode: false,
            nytReaderAverage: 4.2,
            nytReaderSource: 'manual',
          },
          {
            date: (() => {
              const older = new Date(yesterday);
              older.setDate(older.getDate() - 1);
              return `${older.getFullYear()}-${String(older.getMonth() + 1).padStart(2, '0')}-${String(older.getDate()).padStart(2, '0')}`;
            })(),
            solution: 'SLATE',
            attempts: 4,
            won: true,
            hardMode: false,
            nytReaderSource: 'manual',
          },
        ],
      });
      return date;
    });
    const root = new URL(background.url()).origin;
    // URL.origin is "null" for extension schemes in some runtimes.
    const extensionRoot =
      root === 'null'
        ? background.url().replace(/\/background\.js.*$/, '')
        : root;
    const errors: string[] = [];
    context.on('page', (page) =>
      page.on('pageerror', (error) => errors.push(error.message))
    );
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 600 });
    await popup.emulateMedia({ reducedMotion: 'no-preference' });
    await popup.goto(`${extensionRoot}/popup.html`);
    const brand = popup.getByRole('heading', {
      name: 'Wordle Companion',
      exact: true,
    });
    await expect(brand).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() =>
        brand.evaluate((heading) => {
          const bounds = heading.getBoundingClientRect();
          const refresh = document
            .getElementById('refresh-btn')!
            .getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(heading);
          return (
            heading.isConnected &&
            bounds.width > 0 &&
            bounds.right <= refresh.left &&
            range.getClientRects().length === 1
          );
        })
      )
      .toBe(true);
    await expect(
      popup.getByRole('button', { name: 'Play', exact: true })
    ).toHaveCount(0);
    await expect(popup.locator('#popup-play-controls')).toHaveCount(0);
    await expect(popup.locator('.stats-grid')).toBeVisible();
    const { boardBefore, tileBefore, popupBefore, statsBottom, footerTop } =
      await popup.evaluate(() => {
        const bounds = (selector: string) => {
          const { x, y, width, height } = document
            .querySelector(selector)!
            .getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          boardBefore: bounds('#popup-game-board'),
          tileBefore: bounds('.board-cell'),
          popupBefore: bounds('.popup-container'),
          statsBottom: document
            .querySelector('.stats-grid')!
            .getBoundingClientRect().bottom,
          footerTop: document
            .querySelector('.popup-footer')!
            .getBoundingClientRect().top,
        };
      });
    expect(footerTop - statsBottom).toBeGreaterThanOrEqual(0);
    expect(footerTop - statsBottom).toBeLessThanOrEqual(4);
    await popup.getByLabel('Show unplayed').check();
    await popup.keyboard.press('ArrowRight');
    await expect(popup.locator('.board-cell-empty')).toHaveCount(30);
    const popupBoard = popup.frameLocator('iframe[title="Play Wordle"]');
    await expect(
      popupBoard.getByRole('button', { name: 'Type P', exact: true })
    ).toBeEnabled();
    await popup.keyboard.press('ArrowLeft');
    await expect(popup.locator('#popup-play-controls')).toHaveCount(0);
    await popup.keyboard.press('ArrowRight');
    await expect(
      popupBoard.getByRole('button', { name: 'Type P', exact: true })
    ).toBeEnabled();
    await expect(popupBoard.getByRole('textbox')).toHaveCount(0);
    await expect(popupBoard.locator('body')).not.toContainText('Six guesses');
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(popup.locator('#popup-game-board')).toHaveCSS(
      'outline-style',
      'none'
    );
    expect(await popup.locator('#popup-game-board').boundingBox()).toEqual(
      boardBefore
    );
    expect(await popup.locator('.board-cell').first().boundingBox()).toEqual(
      tileBefore
    );
    expect(await popup.locator('.popup-container').boundingBox()).toEqual(
      popupBefore
    );
    await expect(popupBoard.locator('.play-board')).toHaveCount(0);
    expect(
      (await popup.locator('.stats-play-region').boundingBox())!.y
    ).toBeGreaterThanOrEqual(boardBefore!.y + boardBefore!.height);
    await popup.locator('#popup-play-controls').evaluate((frame) => {
      frame.dataset.instance = 'retained';
    });
    const controlsSize = await popupBoard.locator('body').evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(controlsSize.scrollHeight).toBeLessThanOrEqual(
      controlsSize.viewportHeight
    );
    const placement = await popupBoard
      .locator('.play-popout button')
      .evaluate((button) => {
        const popout = button.getBoundingClientRect();
        const keyboard = document
          .querySelector('.play-keyboard')!
          .getBoundingClientRect();
        return {
          gap: popout.top - keyboard.bottom,
          right: popout.right - keyboard.right,
        };
      });
    expect(placement.gap).toBeGreaterThanOrEqual(0);
    expect(placement.gap).toBeLessThanOrEqual(12);
    expect(Math.abs(placement.right)).toBeLessThanOrEqual(1);
    const key = popupBoard.getByRole('button', { name: 'Type Y', exact: true });
    const keyboardBounds = await popupBoard
      .locator('.play-keyboard')
      .boundingBox();
    const keyBounds = await key.boundingBox();
    await key.hover();
    expect(await popupBoard.locator('.play-keyboard').boundingBox()).toEqual(
      keyboardBounds
    );
    expect(await key.boundingBox()).toEqual(keyBounds);
    await popup.keyboard.type('ZZZZZ');
    await popup.keyboard.press('Enter');
    await expect
      .poll(() =>
        popup
          .locator('.board-row')
          .first()
          .evaluate((row) =>
            row
              .getAnimations()
              .some((animation) => animation.id === 'wordle-invalid-guess')
          )
      )
      .toBe(true);
    const shake = await popup
      .locator('.board-row')
      .first()
      .evaluate((row) => {
        const animation = row
          .getAnimations()
          .find((animation) => animation.id === 'wordle-invalid-guess')!;
        animation.pause();
        animation.currentTime = 200;
        const transform = getComputedStyle(row).transform;
        animation.finish();
        return transform;
      });
    expect(shake).not.toBe('none');
    await expect(popupBoard.locator('.play-error')).toHaveCount(0);
    await expect(
      popup.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['Z', 'Z', 'Z', 'Z', 'Z']);
    for (let index = 0; index < 5; index++)
      await popup.keyboard.press('Backspace');
    await popup.locator('#popup-root').evaluate((root) => {
      const observer = new MutationObserver(() => {
        const cell = root.querySelector<HTMLElement>('.board-cell');
        const animation = cell
          ?.getAnimations()
          .find((animation) => animation.id === 'wordle-letter-pop');
        if (!cell || cell.textContent?.trim() !== 'P' || !animation) return;
        observer.disconnect();
        animation.pause();
        animation.currentTime = 50;
        (root as HTMLElement).dataset.entryPopSize = JSON.stringify({
          animated: cell.getBoundingClientRect().width,
          normal: cell.offsetWidth,
        });
        animation.finish();
      });
      observer.observe(root, { childList: true, subtree: true });
    });
    await popup.keyboard.type('P');
    await expect(popup.locator('#popup-root')).toHaveAttribute(
      'data-entry-pop-size',
      /animated/
    );
    const enteredSize = JSON.parse(
      (await popup.locator('#popup-root').getAttribute('data-entry-pop-size'))!
    );
    expect(enteredSize.animated).toBeGreaterThan(enteredSize.normal);
    await popup.keyboard.type('APAL');
    await expect(
      popup.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['P', 'A', 'P', 'A', 'L']);
    const draftBackground = await popup
      .locator('.board-cell-tbd')
      .last()
      .evaluate((cell) => getComputedStyle(cell).backgroundColor);
    const keyboardBefore = await popupBoard
      .locator('.play-keyboard')
      .evaluate((keyboard) => {
        const measure = () => {
          const { x, y, width, height } = keyboard.getBoundingClientRect();
          const buttons = Array.from(keyboard.querySelectorAll('button'));
          return {
            x,
            y,
            width,
            height,
            opacities: buttons.map(
              (button) => getComputedStyle(button).opacity
            ),
          };
        };
        const observer = new MutationObserver(() => {
          if (keyboard.getAttribute('aria-busy') !== 'true') return;
          (keyboard as HTMLElement).dataset.busyMeasure =
            JSON.stringify(measure());
          observer.disconnect();
        });
        observer.observe(keyboard, {
          attributes: true,
          attributeFilter: ['aria-busy'],
        });
        return measure();
      });
    await popupBoard
      .getByRole('button', { name: 'Enter', exact: true })
      .click();
    await expect(
      popup.locator('.board-row').first().locator('.board-cell-present')
    ).toHaveCount(3);
    await expect(
      popup.locator('.board-row').first().locator('.board-cell-correct')
    ).toHaveCount(1);
    const busyMeasure = await popupBoard
      .locator('.play-keyboard')
      .getAttribute('data-busy-measure');
    expect(busyMeasure).not.toBeNull();
    expect(JSON.parse(busyMeasure!)).toEqual(keyboardBefore);
    const reveal = await popup
      .locator('.board-row')
      .first()
      .evaluate((row) => {
        const cells = Array.from(row.children);
        const animations = cells.map((cell) =>
          cell
            .getAnimations()
            .find((animation) => animation.id === 'wordle-guess-reveal')
        );
        const animation = animations[4];
        if (!animation?.effect) return null;
        const timing = animation.effect.getTiming();
        const originalTime = animation.currentTime;
        animation.pause();
        animation.currentTime = 0;
        const beforeFlip = getComputedStyle(cells[4]).backgroundColor;
        const fullHeight = cells[4].getBoundingClientRect().height;
        animation.currentTime =
          (timing.delay ?? 0) + Number(timing.duration) * 0.8;
        const afterFlip = getComputedStyle(cells[4]).backgroundColor;
        const transform = getComputedStyle(cells[4]).transform;
        const foldedHeight = cells[4].getBoundingClientRect().height;
        animation.currentTime = originalTime;
        animation.play();
        return {
          beforeFlip,
          afterFlip,
          transform,
          fullHeight,
          foldedHeight,
          elapsed: Number(originalTime),
          delays: animations.flatMap((animation) =>
            animation?.effect ? [animation.effect.getTiming().delay ?? 0] : []
          ),
        };
      });
    expect(reveal).not.toBeNull();
    expect(reveal!.beforeFlip).toBe(draftBackground);
    expect(reveal!.afterFlip).toBe('rgb(201, 180, 88)');
    expect(reveal!.transform).not.toBe('none');
    expect(reveal!.foldedHeight).toBeLessThan(reveal!.fullHeight);
    expect(reveal!.delays[reveal!.delays.length - 1]).toBeGreaterThan(0);
    for (let index = 1; index < reveal!.delays.length; index++)
      expect(reveal!.delays[index]).toBeGreaterThan(reveal!.delays[index - 1]);
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(
      popup.locator('.board-row').nth(1).locator('.board-cell')
    ).toHaveText(['', '', '', '', '']);
    await popup.keyboard.type('Z');
    await expect(
      popup.locator('.board-row').nth(1).locator('.board-cell')
    ).toHaveText(['Z', '', '', '', '']);
    const continuedReveal = await popup
      .locator('.board-row')
      .first()
      .locator('.board-cell')
      .last()
      .evaluate(
        (cell) =>
          cell
            .getAnimations()
            .find((animation) => animation.id === 'wordle-guess-reveal')
            ?.currentTime ?? null
      );
    expect(continuedReveal).not.toBeNull();
    expect(Number(continuedReveal)).toBeGreaterThanOrEqual(reveal!.elapsed);
    await popup.keyboard.type('ZZZZ');
    await popup.keyboard.press('Enter');
    await expect(popupBoard.locator('.play-validation')).toContainText(
      'word list'
    );
    await expect(popupBoard.locator('.play-error')).toHaveCount(0);
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    for (let index = 0; index < 5; index++)
      await popup.keyboard.press('Backspace');
    await expect(popup.locator('#popup-play-controls')).toHaveAttribute(
      'data-instance',
      'retained'
    );
    const dashboard = await context.newPage();
    await dashboard.goto(`${extensionRoot}/dashboard.html#/play/${date}`);
    const dashboardBoard = dashboard.frameLocator(
      'iframe[title="Play Wordle"]'
    );
    await expect(
      dashboardBoard.getByLabel('Puzzle', { exact: true })
    ).toHaveValue(date);
    await expect(dashboardBoard.locator('.play-row').first()).toHaveText(
      'PAPAL'
    );
    await expect(
      dashboardBoard.getByLabel('Wordle board', { exact: true })
    ).toBeFocused();
    await expect(
      dashboardBoard.getByLabel('Wordle board', { exact: true })
    ).toHaveCSS('outline-style', 'none');
    await dashboardBoard
      .getByLabel('Wordle board', { exact: true })
      .pressSequentially('SLA');
    await expect(
      popup.locator('.board-row').nth(1).locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', '', '']);
    const opened = context.waitForEvent('page');
    await dashboardBoard
      .getByRole('button', { name: 'Pop out', exact: true })
      .click();
    const popout = await opened;
    await popout.waitForURL(/popup\.html/);
    const popoutControls = popout.frameLocator('#popup-play-controls');
    await expect(
      popout.locator('.board-row').nth(1).locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', '', '']);
    await expect(popout.locator('.popup-header')).toHaveCSS(
      'background-image',
      await popup
        .locator('.popup-header')
        .evaluate((el) => getComputedStyle(el).backgroundImage)
    );
    await expect(popout.getByRole('textbox')).toHaveCount(0);
    await expect(
      popoutControls.getByRole('button', { name: 'Pop out', exact: true })
    ).toHaveCount(0);
    for (const viewport of [
      { width: 424, height: 680 },
      { width: 380, height: 600 },
    ]) {
      await popout.setViewportSize(viewport);
      expect(
        await popout.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight &&
            document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
      await expect(
        popoutControls.getByRole('button', { name: 'Backspace', exact: true })
      ).toBeInViewport({ ratio: 1 });
      const tile = (await popout.locator('.board-cell').first().boundingBox())!;
      expect(tile.width).toBeGreaterThan(24);
      expect(Math.abs(tile.width - tile.height)).toBeLessThan(1);
    }
    for (const [state, color] of [
      ['correct', 'rgb(106, 170, 100)'],
      ['present', 'rgb(201, 180, 88)'],
      ['absent', 'rgb(120, 124, 126)'],
    ]) {
      await expect(popout.locator(`.board-cell-${state}`).first()).toHaveCSS(
        'background-color',
        color
      );
      await expect(popout.locator(`.board-cell-${state}`).first()).toHaveCSS(
        'color',
        'rgb(255, 255, 255)'
      );
    }
    await expect(popout.locator('body')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)'
    );
    await popout
      .getByRole('button', { name: 'Dashboard', exact: true })
      .click();
    await expect(popout.locator('.popup-header')).toBeVisible();
    await expect(
      popout.getByRole('button', { name: 'Dashboard', exact: true })
    ).toBeEnabled();
    await popout.emulateMedia({ colorScheme: 'dark' });
    await popout.reload();
    await expect(popout.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(popout.locator('.board-cell-absent').first()).toHaveCSS(
      'color',
      'rgb(255, 255, 255)'
    );
    expect(
      await popout.evaluate(
        async () => (await chrome.windows.getCurrent()).type
      )
    ).toBe('popup');
    await popout.goto(`${extensionRoot}/play.html?popout=1`);
    await popout.waitForURL(/popup\.html/);
    await popup.close();
    await expect(popout.locator('#popup-game-board')).toBeFocused();
    for (let index = 0; index < 3; index++)
      await popout.keyboard.press('Backspace');
    await popout.keyboard.type('APPLE');
    await expect(
      dashboardBoard.locator('.play-row').nth(1).locator('.play-cell')
    ).toHaveText(['A', 'P', 'P', 'L', 'E']);
    await popoutControls
      .getByRole('button', { name: 'Enter', exact: true })
      .click();
    await expect(popout.locator('.game-word')).toHaveText('APPLE');
    await expect(
      popout.locator('.board-row').nth(1).locator('.board-cell-correct')
    ).toHaveCount(5);
    await expect(dashboardBoard.getByRole('status')).toContainText('Solved!');
    expect(
      await dashboardBoard
        .locator('.play-row')
        .nth(1)
        .locator('.play-cell')
        .last()
        .evaluate((cell) =>
          cell
            .getAnimations()
            .some((animation) => animation.id === 'wordle-guess-reveal')
        )
    ).toBe(true);
    await expect(popout.locator('#popup-play-controls')).toHaveCount(0);
    await expect
      .poll(async () => {
        const data = await background.evaluate(() =>
          chrome.storage.local.get('games')
        );
        return data.games.find((game: any) => game.date === date).attempts;
      })
      .toBe(0);
    await dashboard.reload();
    await expect(dashboardBoard.getByRole('status')).toContainText('Solved!');
    await expect(dashboardBoard.getByRole('status')).toContainText('APPLE');
    const reopened = await context.newPage();
    await reopened.goto(`${extensionRoot}/popup.html`);
    await expect(
      reopened.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['P', 'A', 'P', 'A', 'L']);
    await expect(
      reopened.getByRole('button', { name: 'Play', exact: true })
    ).toHaveCount(0);
    await expect(reopened.locator('#popup-play-controls')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('unplayed toggles include missing dates, preserve stats and block imported losses with blank boards', async ({
  browserName,
}, testInfo) => {
  test.setTimeout(90000);
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const dates = await background.evaluate(async () => {
      const dates = Array.from({ length: 4 }, (_, age) => {
        const date = new Date();
        date.setDate(date.getDate() - age);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      });
      await chrome.storage.local.set({
        games: [
          {
            date: dates[0],
            attempts: null,
            completed: true,
            won: false,
            hardMode: false,
          },
          {
            date: dates[1],
            attempts: 0,
            won: false,
            hardMode: false,
            solution: 'APPLE',
            nytReaderSource: 'manual',
          },
          {
            date: dates[3],
            attempts: 3,
            won: true,
            hardMode: false,
            solution: 'SLATE',
            nytReaderSource: 'manual',
          },
        ],
      });
      return dates;
    });
    const extensionRoot = background.url().replace(/\/background\.js.*$/, '');
    const popup = await context.newPage();
    await popup.goto(`${extensionRoot}/popup.html`);
    await expect(popup.locator('.board-cell-empty')).toHaveCount(30);
    await expect(
      popup.getByRole('button', { name: 'Play', exact: true })
    ).toHaveCount(0);
    await popup
      .getByRole('button', { name: 'Previous game', exact: true })
      .click();
    await expect(popup.locator('.game-date')).toHaveText(
      new Date(`${dates[3]}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    );
    await popup.getByLabel('Show unplayed').check();
    await popup.getByRole('button', { name: 'Next game', exact: true }).click();
    const controls = popup.frameLocator('#popup-play-controls');
    await expect(
      controls.getByRole('button', { name: 'Type S', exact: true })
    ).toBeEnabled();
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    for (const letter of 'SLA')
      await controls
        .getByRole('button', { name: `Type ${letter}`, exact: true })
        .click();
    await expect(
      popup.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', '', '']);
    const retainedFrame = await popup
      .locator('#popup-play-controls')
      .elementHandle();
    const retainedKeyboard = await controls
      .locator('.play-keyboard')
      .elementHandle();
    await popup.getByRole('button', { name: 'Next game', exact: true }).click();
    expect(await retainedFrame!.evaluate((frame) => frame.isConnected)).toBe(
      true
    );
    await expect(
      controls.getByRole('button', { name: 'Type S', exact: true })
    ).toBeEnabled();
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(
      popup.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['', '', '', '', '']);
    await expect(popup.locator('.board-cell-empty')).toHaveCount(30);
    expect(
      await retainedKeyboard!.evaluate((keyboard) => keyboard.isConnected)
    ).toBe(true);
    await popup.keyboard.press('ArrowLeft');
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(
      popup.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', '', '']);
    await popup.keyboard.press('ArrowRight');
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(popup.locator('.board-cell-empty')).toHaveCount(30);
    expect(await retainedFrame!.evaluate((frame) => frame.isConnected)).toBe(
      true
    );
    expect(
      await retainedKeyboard!.evaluate((keyboard) => keyboard.isConnected)
    ).toBe(true);
    await popup.getByRole('button', { name: 'Next game', exact: true }).click();
    await expect(popup.locator('#popup-play-controls')).toHaveCount(0);
    await expect(popup.locator('.stats-grid')).toBeVisible();
    await expect(
      popup.getByRole('button', { name: 'Play', exact: true })
    ).toHaveCount(0);
    await popup.getByLabel('Show unplayed').uncheck();

    const dashboard = await context.newPage();
    await dashboard.goto(`${extensionRoot}/dashboard.html`);
    await expect(dashboard.locator('.solve-tile')).toHaveCount(2);
    await expect(
      dashboard.locator('.solve-analytics .section-subtitle')
    ).toHaveCount(0);
    for (const width of [1280, 400]) {
      await dashboard.setViewportSize({ width, height: 900 });
      const layout = await dashboard
        .locator('.solve-unplayed-toggle')
        .evaluate((label) => {
          const section = label.closest('.solve-analytics')!;
          const style = getComputedStyle(section);
          const checkbox = label
            .querySelector('input')!
            .getBoundingClientRect();
          const text = label.querySelector('span')!.getBoundingClientRect();
          const bounds = label.getBoundingClientRect();
          return {
            checkboxWidth: checkbox.width,
            checkboxHeight: checkbox.height,
            fontSize: parseFloat(getComputedStyle(label).fontSize),
            height: bounds.height,
            gap: text.left - checkbox.right,
            alignment: Math.abs(
              text.top + text.height / 2 - checkbox.top - checkbox.height / 2
            ),
            left:
              bounds.left -
              section.getBoundingClientRect().left -
              parseFloat(style.paddingLeft) -
              parseFloat(style.borderLeftWidth),
            belowHeading:
              bounds.top >=
              section.querySelector('h2')!.getBoundingClientRect().bottom,
            fits: bounds.right <= section.getBoundingClientRect().right,
          };
        });
      expect(layout.checkboxWidth).toBeGreaterThanOrEqual(20);
      expect(layout.checkboxHeight).toBeGreaterThanOrEqual(20);
      expect(layout.fontSize).toBeGreaterThanOrEqual(16);
      expect(layout.height).toBeGreaterThanOrEqual(44);
      expect(layout.gap).toBeGreaterThanOrEqual(0);
      expect(layout.gap).toBeLessThanOrEqual(10);
      expect(layout.alignment).toBeLessThanOrEqual(1);
      expect(Math.abs(layout.left)).toBeLessThanOrEqual(1);
      expect(layout.belowHeading).toBe(true);
      expect(layout.fits).toBe(true);
    }
    await dashboard.setViewportSize({ width: 1280, height: 900 });
    const stats = await dashboard.locator('.stats-panel').innerText();
    await dashboard.locator('.solve-unplayed-toggle span').click();
    await expect(dashboard.locator('.solve-tile')).toHaveCount(4);
    expect(await dashboard.locator('.stats-panel').innerText()).toBe(stats);
    await expect(popup.getByLabel('Show unplayed')).toBeChecked();
    const missing = dashboard
      .locator('.solve-tile')
      .filter({ hasText: dates[2] });
    await expect(missing.locator('summary')).not.toContainText('Solver');
    await expect(missing.locator('summary')).not.toContainText('NYT readers');
    await expect(missing.locator('.solve-turns > span')).toHaveCount(1);
    const played = dashboard
      .locator('.solve-tile')
      .filter({ hasText: dates[3] });
    await expect(played.locator('summary')).toContainText('Solver');
    await expect(played.locator('summary')).toContainText('NYT readers');
    expect(
      (await missing.locator('summary').boundingBox())!.height
    ).toBeLessThanOrEqual(
      (await played.locator('summary').boundingBox())!.height + 1
    );
    await missing.locator('summary').click();
    await expect(missing.locator('h4')).toHaveCount(0);
    await expect(
      missing.getByRole('link', { name: 'Play', exact: true })
    ).toHaveCount(0);
    const game = dashboard.frameLocator(
      `iframe[title="Play Wordle ${dates[2]}"]`
    );
    await expect(
      game.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', '', '']);
    await expect(game.locator('#popup-game-board')).toBeFocused();
    await expect
      .poll(() =>
        dashboard.evaluate(
          (date) =>
            document.activeElement ===
            document.querySelector(`iframe[title="Play Wordle ${date}"]`),
          dates[2]
        )
      )
      .toBe(true);
    await expect(game.locator('.score-metrics')).toHaveCount(0);
    await expect(game.locator('#solver-solution-btn')).toHaveCount(0);
    const originalViewport = dashboard.viewportSize()!;
    for (const width of [1280, 800, 390]) {
      await dashboard.setViewportSize({ width, height: 900 });
      const layout = await game
        .locator('#popup-game-board')
        .evaluate((board) => {
          const bounds = board.getBoundingClientRect();
          return {
            center: bounds.x + bounds.width / 2,
            width: document.documentElement.clientWidth,
            scrollWidth: document.body.scrollWidth,
          };
        });
      expect(Math.abs(layout.center - layout.width / 2)).toBeLessThan(1);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
      const keys = await game
        .frameLocator('#popup-play-controls')
        .locator('.play-keyboard button')
        .evaluateAll((buttons) => {
          const width = document.documentElement.clientWidth;
          return buttons.map((button) => {
            const bounds = button.getBoundingClientRect();
            return (
              bounds.left >= 0 &&
              bounds.right <= width &&
              bounds.bottom <= document.documentElement.clientHeight
            );
          });
        });
      expect(keys).toHaveLength(28);
      expect(keys.every(Boolean)).toBe(true);
      await expect
        .poll(async () => {
          const contentHeight = await game
            .locator('.popup-container')
            .evaluate((element) =>
              Math.ceil(element.getBoundingClientRect().height)
            );
          const frameHeight = await missing
            .locator('iframe')
            .evaluate((frame) => frame.getBoundingClientRect().height);
          return Math.abs(frameHeight - contentHeight);
        })
        .toBeLessThanOrEqual(1);
      await expect
        .poll(() =>
          game
            .frameLocator('#popup-play-controls')
            .getByRole('button', { name: 'Pop out', exact: true })
            .evaluate(
              (button) =>
                document.documentElement.clientHeight -
                button.getBoundingClientRect().bottom
            )
        )
        .toBeLessThanOrEqual(6);
    }
    await dashboard.setViewportSize(originalViewport);
    await dashboard.keyboard.type('TE');
    await expect(
      game.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', 'T', 'E']);
    await missing.locator('summary').click();
    await expect(missing.locator('iframe')).toHaveCount(0);
    await missing.locator('summary').click();
    await expect(
      game.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', 'T', 'E']);
    await expect(game.locator('#popup-game-board')).toBeFocused();
    await expect
      .poll(() =>
        dashboard.evaluate(
          (date) =>
            document.activeElement ===
            document.querySelector(`iframe[title="Play Wordle ${date}"]`),
          dates[2]
        )
      )
      .toBe(true);
    await dashboard.keyboard.press('Backspace');
    await expect(
      game.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', 'T', '']);
    await background.evaluate(async (date) => {
      const stored = await chrome.storage.local.get('games');
      await chrome.storage.local.set({
        games: [
          ...stored.games,
          { date, attempts: 3, won: true, hardMode: false },
        ],
      });
    }, dates[2]);
    await expect(game.locator('#popup-play-controls')).toHaveCount(0);
    await popup
      .getByRole('button', { name: 'Previous game', exact: true })
      .click();
    await popup
      .getByRole('button', { name: 'Previous game', exact: true })
      .click();
    await expect(
      popup.getByRole('button', { name: 'Play', exact: true })
    ).toHaveCount(0);
    await expect(popup.locator('#popup-play-controls')).toHaveCount(0);
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('restored full drafts have visible editable tiles and advance with either keyboard', async ({
  browserName,
}, testInfo) => {
  test.setTimeout(90000);
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    await background.evaluate(async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      await chrome.storage.local.set({
        games: [
          {
            date,
            attempts: 0,
            won: false,
            hardMode: false,
            solution: 'APPLE',
            nytReaderSource: 'manual',
          },
        ],
        wordleShowUnplayed: true,
        popup_current_game_index: 1,
        popup_last_games_count: 2,
        wordlePlaySessions: {
          [date]: {
            date,
            mode: 'replay',
            status: 'playing',
            draft: 'TROTT',
            canPlay: true,
            rows: [
              [...'SALET'].map((letter) => ({
                letter,
                status: letter === 'T' ? 'present' : 'absent',
              })),
            ],
          },
        },
      });
    });
    const extensionRoot = background.url().replace(/\/background\.js.*$/, '');
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 600 });
    await popup.goto(`${extensionRoot}/popup.html`);
    const controls = popup.frameLocator('#popup-play-controls');
    const row = popup.locator('.board-row').nth(1).locator('.board-cell');
    await expect(row).toHaveText(['T', 'R', 'O', 'T', 'T']);
    expect(
      await popup
        .locator('#popup-game-board')
        .evaluate((board) => board.getAnimations({ subtree: true }))
    ).toHaveLength(0);
    await expect(row.first()).toHaveCSS('color', 'rgb(26, 26, 27)');
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(
      popup.getByRole('button', { name: 'Play', exact: true })
    ).toHaveCount(0);
    await expect(controls.locator('body')).not.toContainText('Six guesses');
    await popup.getByLabel('Show unplayed').focus();
    await popup.keyboard.press('Backspace');
    await expect(row).toHaveText(['T', 'R', 'O', 'T', ''], { timeout: 5000 });
    await popup.getByRole('button', { name: 'Dashboard', exact: true }).focus();
    await popup.keyboard.press('Backspace');
    await popup.keyboard.type('W');
    await expect(row).toHaveText(['T', 'R', 'O', 'W', '']);
    for (let index = 0; index < 4; index++)
      await popup.keyboard.press('Backspace');
    for (const letter of 'SLATE')
      await controls
        .getByRole('button', { name: new RegExp(`^Type ${letter}(?:,|$)`) })
        .click();
    await expect(row).toHaveText(['S', 'L', 'A', 'T', 'E']);
    await expect(row.first()).toHaveCSS('color', 'rgb(26, 26, 27)');
    await popup.emulateMedia({ reducedMotion: 'reduce' });
    await controls.getByRole('button', { name: 'Enter', exact: true }).click();
    await expect(
      popup.locator('.board-row').nth(1).locator('.board-cell-tbd')
    ).toHaveCount(0);
    expect(
      await row.evaluateAll((cells) =>
        cells.flatMap((cell) => cell.getAnimations())
      )
    ).toHaveLength(0);
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell')
    ).toHaveText(['', '', '', '', '']);
    await popup.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'play-test-input';
      input.type = 'text';
      document.body.append(input);
      input.focus();
    });
    await popup.keyboard.type('AB');
    await expect(popup.locator('#play-test-input')).toHaveValue('AB');
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell')
    ).toHaveText(['', '', '', '', '']);
    await popup.locator('#play-test-input').evaluate((input) => input.remove());
    await popup.locator('body').click({ position: { x: 2, y: 2 } });
    await expect(popup.locator('body')).toBeFocused();
    await popup.keyboard.press('Control+A');
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell')
    ).toHaveText(['', '', '', '', '']);
    await popup.keyboard.type('P');
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell-tbd')
    ).toHaveText('P');
    await controls.locator('body').click({ position: { x: 2, y: 155 } });
    await expect(controls.locator('body')).toBeFocused();
    await popup.keyboard.type('L');
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell')
    ).toHaveText(['P', 'L', '', '', '']);
    await controls.locator('body').click({ position: { x: 2, y: 155 } });
    await popup.keyboard.press('ArrowRight');
    await expect(
      controls.getByRole('button', { name: 'Connect NYT', exact: true })
    ).toBeEnabled();
    await controls
      .getByRole('button', { name: 'Connect NYT', exact: true })
      .focus();
    await popup.keyboard.press('ArrowLeft');
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell')
    ).toHaveText(['P', 'L', '', '', '']);
    await expect(controls.getByRole('alert')).toHaveCount(0);
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});

test('live NYT feedback comes through a background tab without changing the active tab', async ({
  browserName,
}, testInfo) => {
  test.skip(
    process.env.WORDLE_LIVE_TEST !== '1',
    'Opt-in anonymous NYT integration check.'
  );
  test.setTimeout(150000);
  const extensionPath = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: testInfo.project.use.channel || browserName,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const background = await backgroundWorker(context);
    const extensionRoot = background.url().replace(/\/background\.js.*$/, '');
    await background.evaluate(() =>
      chrome.storage.local.set({ wordleShowUnplayed: true })
    );
    const play = await context.newPage();
    await play.goto(`${extensionRoot}/popup.html`);
    const controls = play.frameLocator('#popup-play-controls');
    await expect(
      controls.getByRole('button', { name: 'Connect NYT', exact: true })
    ).toBeEnabled();
    await expect(
      controls.getByRole('button', { name: 'Pop out', exact: true })
    ).toBeInViewport({ ratio: 1 });
    expect(
      await controls
        .locator('body')
        .evaluate(() => document.documentElement.scrollHeight <= innerHeight)
    ).toBe(true);
    await controls
      .getByRole('button', { name: 'Connect NYT', exact: true })
      .click();
    await expect(
      controls.getByRole('button', { name: 'Type Z', exact: true })
    ).toBeEnabled({ timeout: 90000 });
    await expect(play.locator('#popup-game-board')).toBeFocused();
    await play.keyboard.type('ZZZZZ');
    await controls.getByRole('button', { name: 'Enter', exact: true }).click();
    await expect(controls.getByRole('alert')).toContainText(/not.*word/i, {
      timeout: 15000,
    });
    await expect(
      play.locator('.board-row').first().locator('[data-state="tbd"]')
    ).toHaveCount(5);
    await expect(play.locator('#popup-game-board')).toBeFocused();
    for (let index = 0; index < 5; index++)
      await play.keyboard.press('Backspace');
    await play.keyboard.type('SLATE');
    const activeBefore = await background.evaluate(
      async () =>
        (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
          ?.id
    );
    await controls.getByRole('button', { name: 'Enter', exact: true }).click();
    await expect(play.locator('#popup-game-board')).toHaveAttribute(
      'aria-busy',
      'false',
      { timeout: 15000 }
    );
    expect(await controls.getByRole('alert').allTextContents()).toEqual([]);
    await expect(play.locator('#popup-game-board')).toBeFocused();
    await expect(
      play.locator('.board-row').first().locator('[data-state="empty"]')
    ).toHaveCount(0, { timeout: 15000 });
    const state = await play.evaluate(async () => {
      const result = await chrome.storage.local.get('wordlePlaySessions');
      return Object.values(result.wordlePlaySessions)[0] as any;
    });
    const nyt = context
      .pages()
      .find((page) =>
        page.url().startsWith('https://www.nytimes.com/games/wordle')
      );
    expect(nyt).toBeTruthy();
    const official = await nyt!
      .locator('[class*="Board-module_board"] [data-testid="tile"]')
      .evaluateAll((tiles) =>
        tiles.slice(0, 5).map((tile) => ({
          letter: tile.textContent?.trim().toUpperCase(),
          status: tile.getAttribute('data-state'),
        }))
      );
    expect(state.rows[0]).toEqual(official);
    expect(state.answer).toBeUndefined();
    const activeAfter = await background.evaluate(
      async () =>
        (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
          ?.id
    );
    expect(activeAfter).toBe(activeBefore);
    await play.reload();
    await expect(
      play.locator('.board-row').first().locator('.board-cell')
    ).toHaveText(['S', 'L', 'A', 'T', 'E']);
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
});
