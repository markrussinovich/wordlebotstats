import { chromium, expect, type Worker } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { feedbackCells, scoreGuess } from '../src/solver/solver';
import { localPuzzleDate } from '../src/types/playTypes';
import type { GameResult } from '../src/types/gameTypes';

const assets = path.resolve('listing', 'assets');
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return localPuzzleDate(date);
};
const answers =
  'PLANT APPLE CRANE BRICK CHAIR CLOUD DREAM EARTH FLAME GRAPE HOUSE LIGHT MANGO NORTH OCEAN PARTY QUEEN RIVER SHEEP TRAIN WATER YOUTH BREAD CHARM DANCE FROST GIANT HEART LEMON MOUSE PEACH STONE'.split(
    ' '
  );
const starters = ['SLATE', 'CRONY', 'MOUND', 'FIGHT', 'BERRY', 'QUICK'];
const games: GameResult[] = Array.from({ length: 96 }, (_, index) => {
  const answer = answers[index % answers.length];
  const won = index % 19 !== 0;
  const turns = won ? [3, 4, 3, 5, 2, 4, 6, 3][index % 8] : 7;
  const guesses = starters
    .filter((word) => word !== answer)
    .slice(0, won ? turns - 1 : 6);
  if (won) guesses.push(answer);
  return {
    date: day(98 - index),
    solution: answer,
    won,
    attempts: turns,
    hardMode: index % 13 === 0,
    skillScore: 82 + ((index * 7) % 18),
    luckScore: won ? 24 + ((index * 11) % 73) : 0,
    nytReaderAverage: 3.7 + (index % 7) / 10,
    nytReaderSource: 'manual',
    nytReaderMode: index % 13 === 0 ? 'hard' : 'normal',
    guessPattern: guesses.map((guess) =>
      feedbackCells(guess, scoreGuess(guess, answer))
    ),
  };
});
games.push({ date: day(0), attempts: 0, won: false, hardMode: false });

async function capture() {
  await mkdir(assets, { recursive: true });
  const extension = path.resolve('dist');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const errors: string[] = [];
  context.on('page', (page) =>
    page.on('pageerror', (error) => errors.push(error.message))
  );
  try {
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
    await background!.evaluate(
      async (data) => {
        await chrome.storage.local.set({
          games: data.games,
          wordleShowUnplayed: true,
          wordlePastPuzzles: {
            [data.replay]: { print_date: data.replay, solution: 'PLANT' },
            [data.other]: { print_date: data.other, solution: 'CRANE' },
          },
        });
      },
      { games, replay: day(1), other: day(2) }
    );
    const root = background!.url().replace(/\/background\.js.*$/, '');
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 580 });
    await popup.goto(`${root}/popup.html`);
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    await popup.keyboard.press('ArrowLeft');
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'data-date',
      day(1)
    );
    await expect(popup.locator('#popup-game-board')).toBeFocused();
    for (const [index, guess] of ['SLATE', 'CRONY'].entries()) {
      await expect(popup.locator('#popup-game-board')).toHaveAttribute(
        'aria-busy',
        'false'
      );
      await popup.keyboard.type(guess, { delay: 30 });
      await expect(
        popup.locator('.board-row').nth(index).locator('.board-cell')
      ).toHaveText(guess.split(''));
      await popup.keyboard.press('Enter');
      await expect(
        popup.locator('.board-row').nth(index).locator('.board-cell-tbd')
      ).toHaveCount(0);
      await expect(
        popup.locator('.board-row').nth(index).locator('.board-cell-empty')
      ).toHaveCount(0);
      await expect(popup.locator('#popup-game-board')).toBeFocused();
    }
    await expect(popup.locator('#popup-game-board')).toHaveAttribute(
      'aria-busy',
      'false'
    );
    await popup.keyboard.type('PL', { delay: 30 });
    await expect(
      popup.locator('.board-row').nth(2).locator('.board-cell')
    ).toHaveText(['P', 'L', '', '', '']);
    const replayPopup = await popup.locator('.popup-container').screenshot();

    const dashboard = await context.newPage();
    await dashboard.goto(`${root}/dashboard.html`);
    await expect(
      dashboard.getByRole('heading', {
        name: 'Wordle Companion',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      dashboard.getByText('Calculating solver paths in the background...')
    ).toBeHidden({ timeout: 90000 });
    const palette = await dashboard.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        background: style.getPropertyValue('--cp-bg').trim(),
        accent: style.getPropertyValue('--cp-accent').trim(),
        accentHover: style.getPropertyValue('--cp-accent-hover').trim(),
        foreground: style.getPropertyValue('--cp-accent-fg').trim(),
        text: style.getPropertyValue('--cp-text').trim(),
        muted: style.getPropertyValue('--cp-text-muted').trim(),
        present: style.getPropertyValue('--cp-wordle-yellow').trim(),
        absent: style.getPropertyValue('--cp-wordle-gray').trim(),
      };
    });
    const save = async (image: Buffer, name: string) =>
      sharp(image).removeAlpha().png().toFile(path.join(assets, name));
    const overview = await dashboard.screenshot();
    await save(overview, 'screenshot-01-overview.png');

    await dashboard.goto(`${root}/dashboard.html#/analytics`);
    await dashboard.getByLabel('Period:').selectOption('30');
    await dashboard.getByLabel('Timeline averaging').selectOption('daily');
    await expect(
      dashboard.getByText('Calculating solver paths in the background...')
    ).toBeHidden({ timeout: 90000 });
    await save(await dashboard.screenshot(), 'screenshot-02-comparisons.png');
    await dashboard.getByLabel('Period:').selectOption('all');
    await dashboard.getByLabel('Show unplayed').check();
    for (const date of [day(0), day(1), day(2)]) {
      const tile = dashboard.locator('.solve-tile').filter({ hasText: date });
      await tile.locator('summary').click();
      await expect(tile.locator('iframe')).toBeVisible();
      await expect(
        dashboard
          .frameLocator(`iframe[title="Play Wordle ${date}"]`)
          .locator('#popup-game-board')
      ).toHaveAttribute('aria-busy', 'false');
    }
    await dashboard
      .locator('.solve-analytics')
      .evaluate((section) => section.scrollIntoView({ block: 'start' }));
    await save(await dashboard.screenshot(), 'screenshot-03-solver-games.png');

    const today = await context.newPage();
    await today.setViewportSize({ width: 380, height: 580 });
    await today.goto(`${root}/popup.html`);
    await expect(today.locator('#popup-game-board')).toBeFocused();
    await today.keyboard.press('ArrowRight');
    await expect(today.locator('#popup-game-board')).toHaveAttribute(
      'data-date',
      day(0)
    );
    await expect(
      today
        .frameLocator('#popup-play-controls')
        .getByRole('button', { name: 'Connect NYT', exact: true })
    ).toBeEnabled();
    const todayPopup = await today.locator('.popup-container').screenshot();

    const text = (
      x: number,
      y: number,
      content: string,
      size = 24,
      color = palette.text,
      anchor = 'start'
    ) =>
      `<text x="${x}" y="${y}" font-size="${size}" font-weight="${size >= 28 ? 800 : 400}" fill="${color}" text-anchor="${anchor}">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
    const svg = (
      width: number,
      height: number,
      content: string,
      background = palette.background
    ) =>
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="${background}"/>
        <g font-family="Segoe UI, Arial, sans-serif">${content}</g></svg>`);
    await save(
      await sharp(
        svg(
          1280,
          800,
          text(
            640,
            64,
            'Play Wordle right from the popup',
            36,
            palette.text,
            'middle'
          ) +
            text(
              640,
              105,
              "Past replays stay local. Connect to NYT for today's game.",
              22,
              palette.muted,
              'middle'
            ) +
            text(410, 760, 'HISTORICAL REPLAY', 20, palette.text, 'middle') +
            text(870, 760, "TODAY'S NYT CONNECTION", 20, palette.text, 'middle')
        )
      )
        .composite([
          { input: replayPopup, left: 220, top: 140 },
          { input: todayPopup, left: 680, top: 140 },
        ])
        .png()
        .toBuffer(),
      'screenshot-04-popup.png'
    );

    const play = await context.newPage();
    await play.setViewportSize({ width: 480, height: 760 });
    await play.goto(`${root}/play.html?date=${day(1)}`);
    await expect(
      play.getByRole('group', { name: 'Wordle board' })
    ).toBeFocused();
    await expect(play.locator('.play-row').nth(2)).toHaveText('PL');
    const playImage = await play.screenshot();
    await save(
      await sharp(
        svg(
          1280,
          800,
          text(80, 200, 'Your next puzzle,', 42) +
            text(80, 254, 'right here.', 42) +
            text(80, 330, 'Choose an unplayed date.') +
            text(80, 372, 'Type directly into the tiles.') +
            text(80, 414, 'Resume across extension views.') +
            text(
              80,
              530,
              'Past replays do not update NYT history.',
              20,
              palette.muted
            ) +
            text(
              80,
              566,
              "Today's guesses use the real NYT game.",
              20,
              palette.muted
            )
        )
      )
        .composite([{ input: playImage, left: 720, top: 20 }])
        .png()
        .toBuffer(),
      'screenshot-05-play.png'
    );
    await save(
      await sharp(overview)
        .composite([{ input: replayPopup, left: 870, top: 90 }])
        .png()
        .toBuffer(),
      'popupanddashboard.png'
    );
    await mkdir(path.join(assets, 'resized'), { recursive: true });
    await sharp(path.join(assets, 'popupanddashboard.png'))
      .removeAlpha()
      .png()
      .toFile(path.join(assets, 'resized', 'popupanddashboard.png'));

    const tiles = (x: number, y: number, size: number) =>
      [...'STATS']
        .map(
          (letter, index) =>
            `<rect x="${x + index * (size + 6)}" y="${y}" width="${size}" height="${size}"
        fill="${index === 0 ? palette.absent : index === 1 ? palette.present : palette.accentHover}"/>` +
            text(
              x + index * (size + 6) + size / 2,
              y + size * 0.72,
              letter,
              size * 0.6,
              palette.foreground,
              'middle'
            )
        )
        .join('');
    await save(
      svg(
        440,
        280,
        tiles(78, 44, 52) +
          text(220, 156, 'Wordle Companion', 28, palette.foreground, 'middle') +
          text(
            220,
            204,
            'Play. Compare. Explore.',
            20,
            palette.foreground,
            'middle'
          ),
        palette.accent
      ),
      'promo-tile-440x280.png'
    );
    await save(
      await sharp(
        svg(
          1400,
          560,
          tiles(64, 60, 66) +
            text(64, 218, 'Wordle Companion', 50, palette.foreground) +
            text(64, 277, 'Play & Stats', 40, palette.foreground) +
            text(
              64,
              348,
              'Play your next puzzle. Explore every result.',
              24,
              palette.foreground
            ) +
            text(64, 409, 'Past replays stay local.', 21, palette.foreground) +
            text(
              64,
              444,
              "Connect to NYT for today's game.",
              21,
              palette.foreground
            ),
          palette.accent
        )
      )
        .composite([
          {
            input: await sharp(overview).resize(640, 400).toBuffer(),
            left: 700,
            top: 60,
          },
          {
            input: await sharp(replayPopup).resize(228, 348).toBuffer(),
            left: 1090,
            top: 160,
          },
        ])
        .png()
        .toBuffer(),
      'marquee-1400x560.png'
    );
    expect(errors).toEqual([]);
    console.log(
      `Captured five listing screenshots, README composite, and two promotional assets in ${assets}`
    );
  } finally {
    for (const page of context.pages()) await page.close();
    await context.close();
  }
}

capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
