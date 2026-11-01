import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import GamePlay from '@/play/GamePlay';
import { MessageType } from '@/types/messagingTypes';
import { PLAY_SESSIONS_KEY, PlaySession } from '@/types/playTypes';

jest.mock('@/dashboard/hooks/useSolver', () => ({
  useSolver: () => ({ results: {}, running: false, error: null }),
}));
jest.mock('@/play/usePlayHistory', () => ({
  usePlayHistory: () => ({
    history: [],
    showUnplayed: true,
    setShowUnplayed: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: () => '00000000-0000-4000-8000-000000000002',
  });
});

it('replaces the keyboard with completed comparisons and preserves the board', async () => {
  window.history.replaceState(null, '', '/');
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  Object.assign(chrome.storage, {
    onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
  });
  const session: PlaySession = {
    date: '2026-10-30',
    mode: 'replay',
    status: 'playing',
    rows: [],
    draft: 'PLANT',
    canPlay: true,
  };
  const won: PlaySession = {
    ...session,
    status: 'won',
    draft: '',
    answer: 'PLANT',
    rows: [[...'PLANT'].map((letter) => ({ letter, status: 'correct' }))],
  };
  let resolveReaders!: (response: object) => void;
  const readers = new Promise<object>((resolve) => {
    resolveReaders = resolve;
  });
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
    if (message.type === MessageType.GET_PLAY_CATALOG)
      return Promise.resolve({
        success: true,
        today: '2026-10-31',
        date: session.date,
        history: [{ date: session.date, played: false }],
      });
    if (message.type === MessageType.GET_PLAY_SESSION)
      return Promise.resolve({ success: true, session });
    if (message.type === MessageType.SUBMIT_PLAY_GUESS)
      return Promise.resolve({ success: true, session: won });
    if (message.type === MessageType.GET_NYT_READER_AVERAGE) return readers;
    return Promise.resolve({ success: true });
  });
  render(<GamePlay />);
  const board = await screen.findByRole('group', { name: 'Wordle board' });
  await waitFor(() => expect(board).toHaveAttribute('data-ready', 'true'));
  fireEvent.keyDown(board, { key: 'Enter' });
  const summary = await screen.findByRole('region', {
    name: 'Completed game comparisons',
  });
  expect(screen.getByRole('group', { name: 'Wordle board' })).toBe(board);
  expect(screen.getByRole('status')).toHaveTextContent('Solved! Answer: PLANT');
  expect(screen.queryByRole('button', { name: 'Type P' })).toBeNull();
  expect(within(summary).getByText('You').parentElement).toHaveTextContent('1');
  await act(async () =>
    resolveReaders({
      success: true,
      game: {
        date: session.date,
        attempts: 1,
        won: true,
        hardMode: false,
        solution: 'PLANT',
        nytReaderAverage: 3.2,
        skillScore: 90,
        luckScore: 49,
      },
    })
  );
  expect(
    within(summary).getByText('NYT readers').parentElement
  ).toHaveTextContent('3.20');
  expect(within(summary).getByText('Skill').parentElement).toHaveTextContent(
    '90'
  );
  expect(within(summary).getByText('Luck').parentElement).toHaveTextContent(
    '49'
  );
});

it('shakes rejected guesses without visible validation text and keeps connection failures visible', async () => {
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: () => '00000000-0000-4000-8000-000000000002',
  });
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  Object.assign(chrome.storage, {
    onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
  });
  const animation = { id: '', cancel: jest.fn() };
  const animate = jest.fn().mockReturnValue(animation);
  Object.defineProperties(HTMLElement.prototype, {
    animate: { configurable: true, value: animate },
    getAnimations: { configurable: true, value: () => [] },
  });
  const session: PlaySession = {
    date: '2026-10-30',
    mode: 'replay',
    status: 'playing',
    rows: [],
    draft: 'ZZZZZ',
    canPlay: true,
  };
  let rejection = {
    success: false,
    invalidGuess: true,
    error: 'Not in the replay word list.',
  };
  let resolveGuess!: (response: typeof rejection) => void;
  let pendingGuess = true;
  const guessResponse = new Promise<typeof rejection>((resolve) => {
    resolveGuess = resolve;
  });
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
    if (message.type === MessageType.GET_PLAY_CATALOG)
      return Promise.resolve({
        success: true,
        today: '2026-10-31',
        date: session.date,
        history: [{ date: session.date, played: false }],
      });
    if (message.type === MessageType.GET_PLAY_SESSION)
      return Promise.resolve({ success: true, session });
    if (message.type === MessageType.SUBMIT_PLAY_GUESS)
      return pendingGuess ? guessResponse : Promise.resolve(rejection);
    return Promise.resolve({ success: true });
  });
  render(<GamePlay />);
  const board = await screen.findByRole('group', { name: 'Wordle board' });
  await waitFor(() => expect(board).toHaveTextContent('ZZZZZ'));
  expect(animate).not.toHaveBeenCalled();
  fireEvent.keyDown(board, { key: 'Enter' });
  expect(board).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Working...')).not.toBeInTheDocument();
  pendingGuess = false;
  await act(async () => resolveGuess(rejection));
  await waitFor(() => expect(animate).toHaveBeenCalled());
  expect(animation.id).toBe('wordle-invalid-guess');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(board).toHaveTextContent('ZZZZZ');
  await waitFor(() => expect(board).toHaveAttribute('aria-busy', 'false'));
  fireEvent.keyDown(board, { key: 'Backspace' });
  fireEvent.keyDown(board, { key: 'Enter' });
  expect(animate).toHaveBeenCalledTimes(2);
  expect(
    (chrome.runtime.sendMessage as jest.Mock).mock.calls.filter(
      ([message]) => message.type === MessageType.SUBMIT_PLAY_GUESS
    )
  ).toHaveLength(1);
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  fireEvent.keyDown(board, { key: 'Z' });
  rejection = {
    success: false,
    invalidGuess: false,
    error: 'Connect to NYT first.',
  };
  fireEvent.keyDown(board, { key: 'Enter' });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Connect to NYT first.'
  );
  expect(animate).toHaveBeenCalledTimes(2);
  delete (HTMLElement.prototype as any).animate;
  delete (HTMLElement.prototype as any).getAnimations;
});

it('keeps controls and key colors mounted while changing dates, including during startup', async () => {
  window.history.replaceState(null, '', '?controls=1&date=2026-10-30');
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  Object.assign(chrome.storage, {
    onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
  });
  let resolveCatalog!: (response: object) => void;
  let resolveNext!: (response: object) => void;
  const catalog = new Promise<object>((resolve) => {
    resolveCatalog = resolve;
  });
  const next = new Promise<object>((resolve) => {
    resolveNext = resolve;
  });
  const session: PlaySession = {
    date: '2026-10-29',
    mode: 'replay',
    status: 'playing',
    draft: '',
    rows: [
      [...'SLATE'].map((letter) => ({ letter, status: 'present' as const })),
    ],
  };
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
    if (message.type === MessageType.GET_PLAY_CATALOG) return catalog;
    if (message.type === MessageType.GET_PLAY_SESSION)
      return message.date === session.date
        ? Promise.resolve({ success: true, session })
        : next;
    return Promise.resolve({ success: true });
  });
  const { unmount } = render(<GamePlay />);
  const select = (date: string) =>
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: window.parent,
        data: { type: 'WORDLE_PLAY_DATE', date },
      })
    );
  try {
    act(() => {
      select(session.date);
    });
    const key = await screen.findByRole('button', { name: 'Type S, present' });
    const keyboard = screen.getByLabelText('Letter keyboard');
    await act(async () =>
      resolveCatalog({
        success: true,
        today: '2026-10-31',
        date: '2026-10-30',
        history: [{ date: '2026-10-30' }, { date: session.date }],
      })
    );
    expect(key).toBeEnabled();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({
      type: MessageType.GET_PLAY_SESSION,
      date: '2026-10-30',
    });
    act(() => {
      select('2026-10-30');
    });
    expect(key).toBeDisabled();
    expect(key).toHaveAttribute('data-state', 'present');
    expect(screen.getByLabelText('Letter keyboard')).toBe(keyboard);
    await act(async () =>
      resolveNext({
        success: true,
        session: { ...session, date: '2026-10-30', rows: [] },
      })
    );
    expect(key).toBeEnabled();
    expect(key).not.toHaveAttribute('data-state');
    expect(keyboard).toContainElement(key);
  } finally {
    unmount();
    window.history.replaceState(null, '', window.location.pathname);
  }
});

it('preserves newer typing across stale live poll responses without carrying drafts into a scored row', async () => {
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: () => '00000000-0000-4000-8000-000000000001',
  });
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  const session: PlaySession = {
    date: '2026-10-31',
    mode: 'live',
    status: 'playing',
    rows: [],
    draft: '',
    canPlay: true,
    nytTabId: 42,
  };
  let listener:
    | ((
        changes: Record<string, chrome.storage.StorageChange>,
        area: string
      ) => void)
    | undefined;
  Object.assign(chrome.storage, {
    onChanged: {
      addListener: jest.fn((callback) => {
        listener = callback;
      }),
      removeListener: jest.fn(() => {
        listener = undefined;
      }),
    },
  });
  let resolvePoll!: (response: object) => void;
  let resolveDraft!: (response: object) => void;
  const poll = new Promise<object>((resolve) => {
    resolvePoll = resolve;
  });
  const saved = new Promise<object>((resolve) => {
    resolveDraft = resolve;
  });
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
    if (message.type === MessageType.GET_PLAY_CATALOG)
      return Promise.resolve({
        success: true,
        today: session.date,
        date: session.date,
        history: [{ date: session.date, played: false }],
      });
    if (message.type === MessageType.GET_PLAY_SESSION)
      return Promise.resolve({ success: true, session });
    if (message.type === MessageType.CONNECT_NYT_PLAY) return poll;
    if (message.type === MessageType.SAVE_PLAY_DRAFT) return saved;
    return Promise.resolve({ success: true });
  });
  render(<GamePlay />);
  await waitFor(() =>
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: MessageType.CONNECT_NYT_PLAY,
      date: session.date,
      poll: true,
    })
  );
  const board = screen.getByRole('group', { name: 'Wordle board' });
  const firstRow = within(board).getByRole('group', { name: 'Guess 1' });
  fireEvent.keyDown(board, { key: 'A' });
  expect(firstRow).toHaveTextContent(/^A$/);
  act(() =>
    listener!(
      { [PLAY_SESSIONS_KEY]: { newValue: { [session.date]: session } } },
      'local'
    )
  );
  expect(firstRow).toHaveTextContent(/^A$/);
  await act(async () => {
    resolveDraft({ success: true });
  });
  await act(async () => {
    resolvePoll({ success: true, session });
  });
  expect(firstRow).toHaveTextContent(/^A$/);
  act(() =>
    listener!(
      {
        [PLAY_SESSIONS_KEY]: {
          newValue: {
            [session.date]: {
              ...session,
              rows: [
                [...'SLATE'].map((letter) => ({ letter, status: 'absent' })),
              ],
            },
          },
        },
      },
      'local'
    )
  );
  expect(firstRow).toHaveTextContent(/^SLATE$/);
  expect(
    within(board).getByRole('group', { name: 'Guess 2' }).textContent
  ).toBe('');
});
