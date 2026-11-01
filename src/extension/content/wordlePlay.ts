import { GuessResult } from '@/types/gameTypes';
import { MessageType } from '@/types/messagingTypes';
import { localPuzzleDate, playStatus } from '@/types/playTypes';

const loadedDate = localPuzzleDate();
let queue: Promise<unknown> = Promise.resolve();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function boardTiles(): HTMLElement[] {
  const board = document.querySelector(
    '[data-testid="board"], [class*="Board-module_board"], [role="grid"]'
  );
  return board
    ? Array.from(
        board.querySelectorAll<HTMLElement>(
          '[data-testid="tile"], [data-state]'
        )
      ).filter((tile) =>
        ['empty', 'tbd', 'correct', 'present', 'absent'].includes(
          tile.dataset.state || ''
        )
      )
    : [];
}

export function readNytRows(): GuessResult[][] {
  const tiles = boardTiles();
  if (tiles.length !== 30)
    throw new Error('NYT is not ready. Open its tab and finish any prompts.');
  const rows: GuessResult[][] = [];
  for (let index = 0; index < 30; index += 5) {
    const row = tiles.slice(index, index + 5);
    if (
      !row.every((tile) =>
        ['correct', 'present', 'absent'].includes(tile.dataset.state || '')
      )
    )
      break;
    rows.push(
      row.map((tile) => ({
        letter: (tile.textContent || '').trim().toUpperCase(),
        status: tile.dataset.state as GuessResult['status'],
      }))
    );
  }
  return rows;
}

function keyButton(key: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `button[data-key="${key}"]`
  );
  if (!button || button.disabled)
    throw new Error('NYT keyboard is unavailable. Open its tab to continue.');
  return button;
}

function checkOverlays(): void {
  const dialog = document.querySelector<HTMLElement>(
    '[role="dialog"], [aria-modal="true"]'
  );
  if (dialog && dialog.getClientRects().length)
    throw new Error('Open NYT and dismiss its dialog before continuing here.');
}

async function dismissHelp(): Promise<void> {
  const help = document.querySelector<HTMLElement>(
    '#help-dialog, [aria-label="help Modal"]'
  );
  if (help && /How To Play/i.test(help.textContent || '')) {
    help
      .querySelector<HTMLButtonElement>('button[aria-label="Close"]')
      ?.click();
    for (let attempt = 0; attempt < 3 && help.isConnected; attempt++) {
      await delay(100);
      finishAnimations(help);
      const closing = help.querySelector('[class*="Modal-module_closing"]');
      if (closing)
        closing.dispatchEvent(
          new AnimationEvent('animationend', {
            bubbles: true,
            animationName: getComputedStyle(closing).animationName,
          })
        );
    }
  }
}

function finishAnimations(element: HTMLElement | null): void {
  // Hidden tabs can defer animation-end handlers that advance NYT's UI.
  for (const animation of element?.getAnimations?.({ subtree: true }) || []) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) {
      try {
        animation.finish();
      } catch {
        /* It may have finished naturally. */
      }
    }
  }
}

async function prepareGame(): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (boardTiles().length === 30) {
      await delay(500);
      await dismissHelp();
      return;
    }
    const start = document.querySelector<HTMLButtonElement>(
      'button[data-testid="Play"]'
    );
    const continuation = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button')
    ).find((button) =>
      /^Continue to Wordle/.test(button.textContent?.trim() || '')
    );
    if (start && !start.disabled) start.click();
    if (
      continuation &&
      !continuation.disabled &&
      continuation.getAttribute('aria-disabled') !== 'true'
    )
      continuation.click();
    await delay(300);
  }
  throw new Error(
    'NYT is not ready. Open its tab, finish any prompts, then reconnect.'
  );
}

export async function handleNytPlay(message: any): Promise<any> {
  if (message.date !== loadedDate || loadedDate !== localPuzzleDate())
    throw new Error(
      'The daily puzzle changed. Reload the NYT tab before connecting.'
    );
  if (message.type === MessageType.NYT_PLAY_STATE) {
    if (message.prepare) await prepareGame();
    return { success: true, rows: readNytRows() };
  }
  await dismissHelp();
  checkOverlays();
  const toastDeadline = Date.now() + 10000;
  while (visibleToast()) {
    if (Date.now() >= toastDeadline)
      throw new Error(
        "Wait for NYT's current message to clear before submitting."
      );
    await delay(100);
  }
  const rows = readNytRows();
  const guess = message.guess;
  if (!/^[A-Z]{5}$/.test(guess || ''))
    throw new Error('Enter a five-letter word.');
  if (message.expectedRows !== rows.length)
    return {
      success: false,
      rows,
      error:
        'NYT changed. Review the synchronized board before submitting again.',
    };
  if (playStatus(rows) !== 'playing')
    return {
      success: false,
      rows,
      error: "Today's official game is already finished.",
    };
  const pending = boardTiles().slice(rows.length * 5, rows.length * 5 + 5);
  if (pending.some((tile) => tile.textContent?.trim()))
    throw new Error(
      'There is an unfinished guess in NYT. Finish or clear it there before submitting here.'
    );
  for (const letter of guess.toLowerCase()) {
    keyButton(letter).click();
    await delay(0);
  }
  const entered = boardTiles()
    .slice(rows.length * 5, rows.length * 5 + 5)
    .map((tile) => tile.textContent?.trim().toUpperCase())
    .join('');
  if (entered !== guess)
    throw new Error(
      'NYT did not accept the keyboard input. Open its tab to continue.'
    );
  keyButton('↵').click();
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    finishAnimations(
      document.querySelector<HTMLElement>(
        '[data-testid="board"], [class*="Board-module_board"]'
      )
    );
    const updated = readNytRows();
    if (updated.length > rows.length) return { success: true, rows: updated };
    const toast = visibleToast();
    if (toast) {
      const error = toast.textContent!.trim();
      for (let index = 0; index < 5; index++) {
        keyButton('←').click();
        await delay(0);
      }
      return { success: false, invalidGuess: true, rows, error };
    }
    await delay(100);
  }
  return {
    success: false,
    rows: readNytRows(),
    error: 'NYT has not confirmed this guess. Reconnect before trying again.',
  };
}

function visibleToast(): HTMLElement | null {
  const toast = document.querySelector<HTMLElement>(
    '[data-testid="toast"], [class*="Toast-module_toast"]'
  );
  return toast?.textContent?.trim() && toast.getClientRects().length
    ? toast
    : null;
}

export function installWordlePlay(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      message.type !== MessageType.NYT_PLAY_STATE &&
      message.type !== MessageType.NYT_PLAY_GUESS
    )
      return false;
    const operation = queue.then(() => handleNytPlay(message));
    queue = operation.catch(() => undefined);
    operation.then(sendResponse).catch((error) =>
      sendResponse({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NYT could not process the request.',
      })
    );
    return true;
  });
}
