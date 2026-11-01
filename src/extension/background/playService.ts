import words from '../../solver/data/words.json';
import { feedbackCells, scoreGuess } from '@/solver/solver';
import { MessageType } from '@/types/messagingTypes';
import {
  localPuzzleDate,
  PLAY_SELECTION_KEY,
  PLAY_SESSIONS_KEY,
  PlayMessage,
  PlaySession,
  playStatus,
} from '@/types/playTypes';
import { ExtensionStorage } from './extensionStorage';
import {
  buildGameHistory,
  gamesWithPlaySessions,
  hasUserGame,
  SHOW_UNPLAYED_KEY,
} from '../../utils/playHistory';

const dictionary = new Set(words.map((word) => word.toUpperCase()));
const nytUrl = 'https://www.nytimes.com/games/wordle/index.html';
let queue: Promise<unknown> = Promise.resolve();
let playWindowId: number | undefined;

function checkDate(date: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date > localPuzzleDate()
  )
    throw new Error('Choose today or an available past puzzle.');
}

async function readSession(date: string): Promise<PlaySession> {
  checkDate(date);
  const stored = await chrome.storage.local.get(PLAY_SESSIONS_KEY);
  const session = stored[PLAY_SESSIONS_KEY]?.[date] as PlaySession | undefined;
  const game = (await ExtensionStorage.getInstance().getAllGames()).find(
    (item) => item.date === date
  );
  if (hasUserGame(game))
    return {
      date,
      mode: date === localPuzzleDate() ? 'live' : 'replay',
      rows: game?.guessPattern || [],
      draft: '',
      status: game?.won ? 'won' : game?.completed ? 'lost' : 'playing',
      canPlay: false,
    };
  if (session) {
    if (
      session.mode !== 'live' ||
      date === localPuzzleDate() ||
      session.rows.length
    )
      return {
        ...session,
        canPlay:
          session.status === 'playing' &&
          session.canPlay !== false &&
          !(session.mode === 'live' && date < localPuzzleDate()),
      };
  }
  return {
    date,
    mode: date === localPuzzleDate() ? 'live' : 'replay',
    rows: [],
    draft: '',
    status: 'playing',
    canPlay: true,
  };
}

async function saveSession(session: PlaySession): Promise<void> {
  const stored = await chrome.storage.local.get(PLAY_SESSIONS_KEY);
  await chrome.storage.local.set({
    [PLAY_SESSIONS_KEY]: {
      ...stored[PLAY_SESSIONS_KEY],
      [session.date]: session,
    },
  });
}

async function replayAnswer(date: string): Promise<string> {
  if (date >= localPuzzleDate())
    throw new Error("Today's answer must come from NYT gameplay.");
  const games = await ExtensionStorage.getInstance().getAllGames();
  const answer = games
    .find((game) => game.date === date)
    ?.solution?.trim()
    .toUpperCase();
  if (answer && /^[A-Z]{5}$/.test(answer)) return answer;
  const key = 'wordlePastPuzzles';
  const stored = await chrome.storage.local.get(key);
  const cached = stored[key]?.[date];
  if (cached?.print_date === date && /^[A-Za-z]{5}$/.test(cached.solution))
    return cached.solution.toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(
      `https://www.nytimes.com/svc/wordle/v2/${date}.json`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error('Puzzle unavailable');
    const puzzle = await response.json();
    if (puzzle.print_date !== date || !/^[A-Za-z]{5}$/.test(puzzle.solution))
      throw new Error('Unrecognized puzzle');
    await chrome.storage.local.set({
      [key]: {
        ...stored[key],
        [date]: { print_date: date, solution: puzzle.solution },
      },
    });
    return puzzle.solution.toUpperCase();
  } catch {
    throw new Error(
      'Could not retrieve this past puzzle from NYT. Try again later.'
    );
  } finally {
    clearTimeout(timer);
  }
}

async function liveTab(
  session: PlaySession,
  create: boolean
): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({
    url: 'https://www.nytimes.com/games/wordle*',
  });
  const tab = tabs.find((item) => item.id === session.nytTabId) || tabs[0];
  if (tab) return tab;
  if (!create) throw new Error("Connect to NYT to load today's official game.");
  return chrome.tabs.create({ url: nytUrl, active: false });
}

async function sendToNyt(
  tabId: number,
  message: object,
  wait: boolean
): Promise<any> {
  const deadline = Date.now() + (wait ? 15000 : 0);
  do {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      if (Date.now() >= deadline)
        throw new Error(
          'NYT is not ready. Open its tab, finish any prompts, then reconnect.'
        );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } while (Date.now() < deadline);
  throw new Error(
    'NYT is not ready. Open its tab, finish any prompts, then reconnect.'
  );
}

function applyLive(
  session: PlaySession,
  response: any,
  tabId: number
): PlaySession {
  if (!response?.success)
    throw new Error(response?.error || 'Could not read the NYT board.');
  const rows = response.rows;
  if (
    !Array.isArray(rows) ||
    rows.length > 6 ||
    !rows.every(
      (row: any) =>
        Array.isArray(row) &&
        row.length === 5 &&
        row.every(
          (cell: any) =>
            /^[A-Z]$/.test(cell.letter) &&
            ['correct', 'present', 'absent'].includes(cell.status)
        )
    )
  )
    throw new Error(
      'NYT returned an unrecognized board. Open its tab to continue.'
    );
  return {
    date: session.date,
    mode: 'live',
    rows,
    draft: rows.length === session.rows.length ? session.draft : '',
    draftClient:
      rows.length === session.rows.length ? session.draftClient : undefined,
    status: playStatus(rows),
    nytTabId: tabId,
    canPlay:
      session.canPlay !== false &&
      !(!session.nytTabId && !session.rows.length && rows.length > 0),
  };
}

export function handlePlayMessage(message: PlayMessage): Promise<any> {
  const operation = queue.then(() => handle(message));
  queue = operation.catch(() => undefined);
  return operation;
}

async function handle(message: PlayMessage): Promise<any> {
  const today = localPuzzleDate();
  if (message.type === MessageType.GET_PLAY_CATALOG) {
    const games = await ExtensionStorage.getInstance().getAllGames();
    const stored = await chrome.storage.local.get([
      PLAY_SELECTION_KEY,
      PLAY_SESSIONS_KEY,
      SHOW_UNPLAYED_KEY,
    ]);
    const history = buildGameHistory(
      gamesWithPlaySessions(games, stored[PLAY_SESSIONS_KEY] || {}),
      true,
      today
    );
    const dates = history
      .filter((game) => !hasUserGame(game))
      .map((game) => game.date);
    const selection = stored[PLAY_SELECTION_KEY];
    return {
      success: true,
      today,
      dates,
      history: history.map((game) => ({
        date: game.date,
        played: hasUserGame(game),
      })),
      showUnplayed: stored[SHOW_UNPLAYED_KEY] === true,
      date: history.some((game) => game.date === selection) ? selection : today,
    };
  }
  const date = message.date || today;
  let session = await readSession(date);
  if (message.type === MessageType.OPEN_PLAY_WINDOW) {
    await chrome.storage.local.set({ [PLAY_SELECTION_KEY]: date });
    const url = chrome.runtime.getURL('popup.html') + '?popout=1';
    if (playWindowId !== undefined) {
      try {
        await chrome.windows.update(playWindowId, { focused: true });
        return { success: true };
      } catch {
        playWindowId = undefined;
      }
    }
    const created = await chrome.windows.create({
      url,
      type: 'popup',
      width: 400,
      height: 660,
    });
    playWindowId = created.id;
    return { success: true };
  }
  if (message.type === MessageType.OPEN_NYT_PLAY_TAB) {
    const tab = await liveTab(session, true);
    if (tab.id !== undefined)
      await chrome.tabs.update(tab.id, { active: true });
    return { success: true };
  }
  if (message.type === MessageType.GET_PLAY_SESSION) {
    if (session.canPlay) await saveSession(session);
    await chrome.storage.local.set({ [PLAY_SELECTION_KEY]: date });
    return { success: true, session };
  }
  if (session.status !== 'playing')
    throw new Error('This game is already finished.');
  if (session.canPlay === false)
    throw new Error('Play is only available on dates without a user game.');
  if (message.type === MessageType.SAVE_PLAY_DRAFT) {
    if (message.expectedRows !== session.rows.length)
      return { success: true, session };
    if (!/^[A-Za-z]{0,5}$/.test(message.draft || ''))
      throw new Error('Use up to five letters.');
    session = {
      ...session,
      draft: (message.draft || '').toUpperCase(),
      draftClient: message.client,
    };
  } else if (message.type === MessageType.RESET_PLAY_REPLAY) {
    if (session.mode !== 'replay')
      throw new Error("Today's official game cannot be reset.");
    session = { date, mode: 'replay', rows: [], draft: '', status: 'playing' };
  } else if (message.type === MessageType.CONNECT_NYT_PLAY) {
    if (session.mode !== 'live')
      throw new Error("Only today's game connects to NYT.");
    const tab = await liveTab(session, !message.poll);
    if (tab.id === undefined) throw new Error('Could not open NYT.');
    const response = await sendToNyt(
      tab.id,
      {
        type: MessageType.NYT_PLAY_STATE,
        date,
        prepare: !message.poll,
      },
      !message.poll
    );
    session = applyLive(session, response, tab.id);
  } else if (message.type === MessageType.SUBMIT_PLAY_GUESS) {
    const guess = message.guess?.trim().toUpperCase() || '';
    if (!/^[A-Z]{5}$/.test(guess))
      return {
        success: false,
        invalidGuess: true,
        error: 'Enter a five-letter word.',
      };
    if (session.status !== 'playing')
      throw new Error('This game is already finished.');
    if (message.expectedRows !== session.rows.length)
      throw new Error(
        'The board changed in another window. Check it before submitting again.'
      );
    if (session.mode === 'replay') {
      const answer = await replayAnswer(date);
      if (!dictionary.has(guess) && guess !== answer)
        return {
          success: false,
          invalidGuess: true,
          error: 'Not in the replay word list.',
        };
      const rows = [
        ...session.rows,
        feedbackCells(guess, scoreGuess(guess, answer)),
      ];
      session = {
        date,
        mode: 'replay',
        rows,
        draft: '',
        status: playStatus(rows),
      };
      if (session.status !== 'playing') session.answer = answer;
    } else {
      const tab = await liveTab(session, false);
      if (tab.id === undefined) throw new Error('Connect to NYT first.');
      const response = await sendToNyt(
        tab.id,
        {
          type: MessageType.NYT_PLAY_GUESS,
          date,
          guess,
          expectedRows: message.expectedRows,
        },
        false
      );
      // A rejected guess may still accompany newer official rows from another surface.
      if (!response?.success && response?.rows) {
        await saveSession(
          applyLive(session, { success: true, rows: response.rows }, tab.id)
        );
      }
      if (response?.invalidGuess) return response;
      session = applyLive(session, response, tab.id);
    }
  } else throw new Error('Unknown play request.');
  await saveSession(session);
  return { success: true, session };
}
