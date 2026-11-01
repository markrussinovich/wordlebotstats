import {
  handleNytPlay,
  installWordlePlay,
  readNytRows,
} from '@/extension/content/wordlePlay';
import { MessageType } from '@/types/messagingTypes';
import { localPuzzleDate } from '@/types/playTypes';

function board(feedbackDelay = 0, rejection = ''): void {
  document.body.innerHTML = `<div data-testid="board">${Array.from(
    { length: 30 },
    () => '<div data-testid="tile" data-state="empty"></div>'
  ).join('')}</div>
    ${[...'abcdefghijklmnopqrstuvwxyz', '↵', '←']
      .map((key) => `<button data-key="${key}">${key}</button>`)
      .join('')}`;
  let input = '';
  document
    .querySelectorAll<HTMLButtonElement>('button[data-key]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.key!;
        if (key === '↵') {
          if (rejection) {
            const toast = document.createElement('div');
            toast.dataset.testid = 'toast';
            toast.textContent = rejection;
            toast.getClientRects = () => ({ length: 1 }) as DOMRectList;
            document.body.append(toast);
            return;
          }
          const mark = () =>
            document
              .querySelectorAll<HTMLElement>(
                '[data-testid="board"] [data-testid="tile"]'
              )
              .forEach((tile, index) => {
                if (index < 5)
                  tile.dataset.state = index === 0 ? 'present' : 'absent';
              });
          if (feedbackDelay) setTimeout(mark, feedbackDelay);
          else mark();
        } else {
          input = key === '←' ? input.slice(0, -1) : input + key.toUpperCase();
          document
            .querySelectorAll<HTMLElement>(
              '[data-testid="board"] [data-testid="tile"]'
            )
            .forEach((tile, index) => {
              if (index < 5) {
                tile.textContent = input[index] || '';
                tile.dataset.state = input[index] ? 'tbd' : 'empty';
              }
            });
        }
      });
    });
}

beforeEach(() => {
  jest.clearAllMocks();
  board();
});

it('submits using the official keyboard and reads only scored board tiles', async () => {
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<div data-testid="tile" data-state="correct">X</div>'
  );
  const response = await handleNytPlay({
    type: MessageType.NYT_PLAY_GUESS,
    date: localPuzzleDate(),
    guess: 'SLATE',
    expectedRows: 0,
  });
  expect(response).toMatchObject({ success: true });
  expect(response.rows[0]).toEqual(
    [...'SLATE'].map((letter, index) => ({
      letter,
      status: index === 0 ? 'present' : 'absent',
    }))
  );
  expect(readNytRows()).toHaveLength(1);
});

it('never overwrites an unfinished official guess or resubmits against a changed board', async () => {
  document.querySelector<HTMLButtonElement>('button[data-key="a"]')!.click();
  await expect(
    handleNytPlay({
      type: MessageType.NYT_PLAY_GUESS,
      date: localPuzzleDate(),
      guess: 'SLATE',
      expectedRows: 0,
    })
  ).rejects.toThrow('unfinished guess');
  expect(document.querySelector('[data-testid="tile"]')!.textContent).toBe('A');
  board();
  const response = await handleNytPlay({
    type: MessageType.NYT_PLAY_GUESS,
    date: localPuzzleDate(),
    guess: 'SLATE',
    expectedRows: 1,
  });
  expect(response).toMatchObject({ success: false, rows: [] });
  expect(document.querySelector('[data-testid="tile"]')!.textContent).toBe('');
});

it('identifies official word-list rejections without consuming a guess', async () => {
  board(0, 'Not in word list');
  const response = await handleNytPlay({
    type: MessageType.NYT_PLAY_GUESS,
    date: localPuzzleDate(),
    guess: 'ZZZZZ',
    expectedRows: 0,
  });
  expect(response).toMatchObject({
    success: false,
    invalidGuess: true,
    rows: [],
    error: 'Not in word list',
  });
  expect(readNytRows()).toHaveLength(0);
});

it('waits for an old validation toast before submitting a new guess', async () => {
  jest.useFakeTimers();
  try {
    board(400);
    const toast = document.createElement('div');
    toast.dataset.testid = 'toast';
    toast.textContent = 'Not in word list';
    toast.getClientRects = () => ({ length: 1 }) as DOMRectList;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 200);
    const response = handleNytPlay({
      type: MessageType.NYT_PLAY_GUESS,
      date: localPuzzleDate(),
      guess: 'SLATE',
      expectedRows: 0,
    });
    await jest.advanceTimersByTimeAsync(1500);
    expect(await response).toMatchObject({ success: true });
    expect(
      readNytRows()[0]
        .map((cell) => cell.letter)
        .join('')
    ).toBe('SLATE');
  } finally {
    jest.useRealTimers();
  }
});

it('rejects date rollover and returns false for unrelated runtime messages', async () => {
  await expect(
    handleNytPlay({ type: MessageType.NYT_PLAY_STATE, date: '2020-01-01' })
  ).rejects.toThrow('daily puzzle changed');
  installWordlePlay();
  const listener = (chrome.runtime.onMessage.addListener as jest.Mock).mock
    .calls[0][0];
  expect(listener({ type: 'UNRELATED' }, {}, jest.fn())).toBe(false);
  const respond = jest.fn();
  expect(
    listener(
      { type: MessageType.NYT_PLAY_STATE, date: localPuzzleDate() },
      {},
      respond
    )
  ).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(respond).toHaveBeenCalledWith({ success: true, rows: [] });
});
