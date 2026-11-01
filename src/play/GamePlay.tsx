import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { MessageType } from '@/types/messagingTypes';
import {
  PLAY_SELECTION_KEY,
  PLAY_SESSIONS_KEY,
  PlaySession,
} from '@/types/playTypes';
import { GameResult } from '@/types/gameTypes';
import { hasUserGame } from '@/utils/playHistory';
import { usePlayHistory } from './usePlayHistory';
import { createGuessReveal, shakeGuess } from './guessReveal';
import { useSolver } from '../dashboard/hooks/useSolver';

const keyboard = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const GamePlay: React.FC = () => {
  const [dates, setDates] = useState<string[]>([]);
  const [catalogGames, setCatalogGames] = useState<GameResult[]>([]);
  const { history, showUnplayed, setShowUnplayed } =
    usePlayHistory(catalogGames);
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [session, setSession] = useState<PlaySession | null>(null);
  const [completedGame, setCompletedGame] = useState<GameResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalidGuess, setInvalidGuess] = useState<{
    date: string;
    row: number;
    message: string;
    token: string;
  } | null>(null);
  const [connected, setConnected] = useState(false);
  const client = useRef(crypto.randomUUID());
  const currentDate = useRef(date);
  const busyRef = useRef(busy);
  const sessionRef = useRef(session);
  const draftRevision = useRef(0);
  const pendingDraft = useRef<{
    date: string;
    rows: number;
    revision: number;
  } | null>(null);
  const preserveLocalDraft = useCallback((incoming: PlaySession) => {
    const pending = pendingDraft.current;
    return (
      incoming.draftClient === client.current ||
      (pending?.date === incoming.date && pending.rows === incoming.rows.length)
    );
  }, []);
  const boardRef = useRef<HTMLDivElement>(null);
  const revealGuesses = useRef(createGuessReveal());
  const keyHandler = useRef<(key: string) => void>(() => {});
  currentDate.current = date;
  busyRef.current = busy;
  sessionRef.current = session;
  const compact =
    new URLSearchParams(window.location.search).get('compact') === '1';
  const controlsOnly =
    new URLSearchParams(window.location.search).get('controls') === '1';
  const popout =
    new URLSearchParams(window.location.search).get('popout') === '1';
  const completed =
    !controlsOnly &&
    session?.date === date &&
    (session.status !== 'playing' || session.canPlay === false);
  const solver = useSolver(
    completed && completedGame?.date === date ? [completedGame] : []
  );
  useEffect(() => {
    let cancelled = false;
    setCompletedGame(null);
    if (!completed || !session) return;
    setCompletedGame({
      date,
      attempts: session.rows.length,
      won: session.status === 'won',
      completed: session.status !== 'playing',
      hardMode: false,
      guessPattern: session.rows,
      solution:
        session.answer ||
        (session.status === 'won'
          ? session.rows[session.rows.length - 1]
              ?.map((cell) => cell.letter)
              .join('')
          : undefined),
    });
    void chrome.runtime
      .sendMessage({ type: MessageType.GET_NYT_READER_AVERAGE, date })
      .then((response) => {
        if (!cancelled && response?.success && response.game?.date === date)
          setCompletedGame(response.game);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [completed, date, session]);

  useLayoutEffect(() => {
    revealGuesses.current(boardRef.current);
  }, [date, session]);

  useLayoutEffect(() => {
    if (!controlsOnly && invalidGuess?.date === date)
      shakeGuess(boardRef.current, invalidGuess.row);
  }, [controlsOnly, date, invalidGuess]);

  useEffect(() => {
    if (controlsOnly && session?.date === date)
      window.parent.postMessage(
        { type: 'WORDLE_PLAY_VIEW', session, busy, invalidGuess },
        window.location.origin
      );
  }, [controlsOnly, date, session, busy, invalidGuess]);

  useEffect(() => {
    if (!controlsOnly || typeof ResizeObserver === 'undefined') return;
    const controls = document.querySelector<HTMLElement>('.wordle-play');
    if (!controls) return;
    const resize = () =>
      window.parent.postMessage(
        {
          type: 'WORDLE_PLAY_SIZE',
          height: Math.ceil(controls.getBoundingClientRect().height),
        },
        window.location.origin
      );
    const observer = new ResizeObserver(resize);
    observer.observe(controls);
    resize();
    return () => observer.disconnect();
  }, [controlsOnly]);

  useEffect(() => {
    if (
      controlsOnly ||
      busy ||
      session?.date !== date ||
      session?.canPlay === false ||
      session?.status !== 'playing'
    )
      return;
    const frame = requestAnimationFrame(() => {
      if (!busyRef.current && sessionRef.current?.date === date) {
        boardRef.current?.focus({ preventScroll: true });
        if (window.parent !== window)
          window.parent.postMessage(
            { type: 'WORDLE_PLAY_READY', date },
            window.location.origin
          );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    controlsOnly,
    busy,
    date,
    session?.date,
    session?.rows.length,
    session?.canPlay,
    session?.status,
  ]);

  useEffect(() => {
    if (!controlsOnly) return;
    const listener = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      )
        return;
      if (
        event.data?.type === 'WORDLE_PLAY_DATE' &&
        typeof event.data.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(event.data.date)
      ) {
        if (event.data.date !== currentDate.current) {
          busyRef.current = true;
          currentDate.current = event.data.date;
          setBusy(true);
          setDate(event.data.date);
        }
        return;
      }
      if (
        event.data?.type === 'WORDLE_PLAY_KEY' &&
        event.data.date === currentDate.current &&
        typeof event.data.key === 'string'
      )
        keyHandler.current(event.data.key);
    };
    const keyListener = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !(event.target instanceof HTMLElement)
      )
        return;
      const target = event.target;
      if (
        target.isContentEditable ||
        target.closest(
          'textarea, select, input:not([type="checkbox"]):not([type="radio"]), [role="textbox"]'
        )
      )
        return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (target.closest('input[type="radio"]')) return;
        event.preventDefault();
        window.parent.postMessage(
          {
            type: 'WORDLE_PLAY_NAV',
            date: currentDate.current,
            key: event.key,
          },
          window.location.origin
        );
        return;
      }
      if (
        event.key === 'Enter' &&
        target.closest('button, a[href], input') &&
        !target.closest('.play-keyboard')
      )
        return;
      if (
        /^[a-z]$/i.test(event.key) ||
        event.key === 'Backspace' ||
        event.key === 'Enter'
      ) {
        event.preventDefault();
        keyHandler.current(event.key);
      }
    };
    window.addEventListener('message', listener);
    window.addEventListener('keydown', keyListener);
    return () => {
      window.removeEventListener('message', listener);
      window.removeEventListener('keydown', keyListener);
    };
  }, [controlsOnly]);

  useEffect(() => {
    let cancelled = false;
    chrome.runtime
      .sendMessage({ type: MessageType.GET_PLAY_CATALOG })
      .then((response) => {
        if (cancelled) return;
        if (!response?.success)
          throw new Error(response?.error || 'Could not load puzzles.');
        setDates(response.history.map((item: { date: string }) => item.date));
        setCatalogGames(
          response.history.map((item: { date: string; played: boolean }) => ({
            date: item.date,
            attempts: item.played ? 1 : 0,
            won: false,
            hardMode: false,
          }))
        );
        setToday(response.today);
        const requested = new URLSearchParams(window.location.search).get(
          'date'
        );
        setDate(
          currentDate.current ||
            (requested &&
            /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
            requested <= response.today
              ? requested
              : response.date)
        );
      })
      .catch((reason) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    pendingDraft.current = null;
    setBusy(true);
    if (!controlsOnly) setSession(null);
    setError('');
    setInvalidGuess(null);
    setConnected(false);
    chrome.runtime
      .sendMessage({ type: MessageType.GET_PLAY_SESSION, date })
      .then((response) => {
        if (cancelled) return;
        if (!response?.success)
          throw new Error(response?.error || 'Could not load this game.');
        setSession(response.session);
        setConnected(Boolean(response.session.nytTabId));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, controlsOnly]);

  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return;
      const selected = changes[PLAY_SELECTION_KEY]?.newValue;
      if (
        !controlsOnly &&
        selected &&
        (selected === today || dates.includes(selected))
      )
        setDate(selected);
      const updated = changes[PLAY_SESSIONS_KEY]?.newValue?.[
        currentDate.current
      ] as PlaySession | undefined;
      if (updated) {
        const preserveDraft = preserveLocalDraft(updated);
        setSession((previous) => ({
          ...updated,
          draft:
            preserveDraft &&
            updated.canPlay !== false &&
            previous?.date === updated.date &&
            previous.rows.length === updated.rows.length
              ? previous.draft
              : updated.draft,
        }));
      }
      if (changes.games) {
        const requestedDate = currentDate.current;
        void chrome.runtime
          .sendMessage({
            type: MessageType.GET_PLAY_SESSION,
            date: requestedDate,
          })
          .then((response) => {
            if (currentDate.current === requestedDate && response?.success) {
              const preserveDraft = preserveLocalDraft(response.session);
              setSession((previous) => ({
                ...response.session,
                draft:
                  response.session.canPlay !== false &&
                  preserveDraft &&
                  previous?.rows.length === response.session.rows.length
                    ? previous!.draft
                    : response.session.draft,
              }));
            }
          });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [controlsOnly, dates, today, preserveLocalDraft]);

  useEffect(() => {
    if (
      !connected ||
      date !== today ||
      session?.canPlay === false ||
      session?.status !== 'playing'
    )
      return;
    let cancelled = false;
    let pending = false;
    const sync = async () => {
      if (pending || busyRef.current) return;
      pending = true;
      const revision = draftRevision.current;
      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.CONNECT_NYT_PLAY,
          date,
          poll: true,
        });
        if (cancelled) return;
        if (!response?.success)
          throw new Error(response?.error || 'NYT connection was lost.');
        const preserveDraft =
          preserveLocalDraft(response.session) ||
          draftRevision.current !== revision;
        setSession((previous) => ({
          ...response.session,
          draft:
            preserveDraft &&
            response.session.canPlay !== false &&
            previous?.rows.length === response.session.rows.length
              ? previous!.draft
              : response.session.draft,
        }));
      } catch (reason) {
        if (!cancelled) {
          setConnected(false);
          setError(
            reason instanceof Error ? reason.message : 'Reconnect to NYT.'
          );
        }
      } finally {
        pending = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    connected,
    date,
    today,
    session?.canPlay,
    session?.status,
    preserveLocalDraft,
  ]);

  const action = async (type: MessageType, extra: object = {}) => {
    if (busyRef.current || !date) return;
    const requestedDate = date;
    setBusy(true);
    busyRef.current = true;
    setError('');
    try {
      const response = await chrome.runtime.sendMessage({
        type,
        date,
        ...extra,
      });
      if (currentDate.current !== requestedDate) return;
      if (type === MessageType.SUBMIT_PLAY_GUESS && response?.invalidGuess) {
        rejectGuess(response.error || 'Invalid guess.');
        return;
      }
      if (!response?.success)
        throw new Error(response?.error || 'The request failed.');
      if (response.session) setSession(response.session);
      if (type === MessageType.CONNECT_NYT_PLAY) setConnected(true);
    } catch (reason) {
      if (currentDate.current === requestedDate)
        setError(
          reason instanceof Error ? reason.message : 'The request failed.'
        );
    } finally {
      if (currentDate.current === requestedDate) setBusy(false);
    }
  };

  const draft = (value: string) => {
    const current = sessionRef.current;
    if (
      !current ||
      busyRef.current ||
      current.canPlay === false ||
      current.status !== 'playing'
    )
      return;
    const next = value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
    if (next === current.draft) return;
    const revision = ++draftRevision.current;
    pendingDraft.current = { date, rows: current.rows.length, revision };
    setError('');
    setInvalidGuess(null);
    sessionRef.current = { ...current, draft: next };
    setSession(sessionRef.current);
    boardRef.current?.focus({ preventScroll: true });
    void chrome.runtime
      .sendMessage({
        type: MessageType.SAVE_PLAY_DRAFT,
        date,
        draft: next,
        expectedRows: current.rows.length,
        client: client.current,
      })
      .then((response) => {
        if (!response?.success)
          throw new Error(response?.error || 'Could not save this guess.');
        if (pendingDraft.current?.revision === revision)
          pendingDraft.current = null;
      })
      .catch(() =>
        setError('Could not save this guess. Keep this window open and retry.')
      );
  };
  const rejectGuess = (message: string) => {
    const current = sessionRef.current;
    if (!current) return;
    setError('');
    setInvalidGuess({
      date: current.date,
      row: current.rows.length,
      message,
      token: crypto.randomUUID(),
    });
  };
  const submit = () => {
    const current = sessionRef.current;
    if (!current || busyRef.current) return;
    if (current.draft.length === 5)
      void action(MessageType.SUBMIT_PLAY_GUESS, {
        guess: current.draft,
        expectedRows: current.rows.length,
      });
    else rejectGuess('Not enough letters.');
  };
  const disabled =
    busy ||
    !session ||
    session.canPlay === false ||
    session.status !== 'playing' ||
    (session.mode === 'live' && !connected);
  const statusMessage = busy
    ? ''
    : session?.status === 'won'
      ? 'Solved!'
      : session?.status === 'lost'
        ? 'No guesses left.'
        : session?.canPlay === false
          ? 'This date already has a user game.'
          : session?.mode === 'live' && !connected
            ? 'Connect to load the NYT board.'
            : '';
  keyHandler.current = (key) => {
    if (disabled || busyRef.current) return;
    const current = sessionRef.current!;
    if (/^[a-z]$/i.test(key)) draft(current.draft + key);
    else if (key === 'Backspace') draft(current.draft.slice(0, -1));
    else if (key === 'Enter') submit();
  };
  const states = new Map<string, string>();
  const rank: Record<string, number> = { absent: 1, present: 2, correct: 3 };
  session?.rows.flat().forEach((cell) => {
    if ((rank[states.get(cell.letter) || ''] || 0) < rank[cell.status])
      states.set(cell.letter, cell.status);
  });
  const completedDetails = completedGame?.date === date ? completedGame : null;
  const solverResult =
    solver.results[completedDetails?.solution?.toUpperCase() || ''];
  const solverTurns =
    solverResult?.status === 'solved'
      ? solverResult.turns
      : solverResult?.status === 'failed'
        ? 'X/6'
        : solver.running
          ? '...'
          : 'N/A';

  return (
    <main
      className={`wordle-play${compact ? ' compact' : ''}${controlsOnly ? ' controls-only' : ''}`}
      onKeyDown={(event) => {
        if (
          disabled ||
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          (event.target as HTMLElement).matches('input, select')
        )
          return;
        if (
          (/^[a-z]$/i.test(event.key) ||
            event.key === 'Backspace' ||
            event.key === 'Enter') &&
          (event.target as HTMLElement).closest('.play-board, .play-keyboard')
        ) {
          event.preventDefault();
          keyHandler.current(event.key);
        }
      }}
    >
      {!controlsOnly && (
        <>
          <header>
            <h1>Wordle Companion</h1>
            {!popout && (
              <button
                disabled={busy || !date}
                onClick={() => void action(MessageType.OPEN_PLAY_WINDOW)}
              >
                Pop out
              </button>
            )}
          </header>
          <label className="play-picker">
            Puzzle
            <select
              aria-label="Puzzle"
              value={date}
              disabled={busy}
              onChange={(event) => setDate(event.target.value)}
            >
              {date && !history.some((game) => game.date === date) && (
                <option value={date}>{date} - unplayed</option>
              )}
              {history.map((game) => (
                <option key={game.date} value={game.date}>
                  {game.date === today ? `Today - ${today} (NYT)` : game.date} -{' '}
                  {hasUserGame(game) ? 'played' : 'unplayed'}
                </option>
              ))}
            </select>
          </label>
          <label className="play-picker">
            <input
              type="checkbox"
              checked={showUnplayed}
              onChange={(event) => setShowUnplayed(event.target.checked)}
            />
            Show unplayed
          </label>
          <p className="play-note">
            {compact
              ? date === today
                ? 'Guesses count toward your NYT result.'
                : 'Replays do not change official stats.'
              : date === today
                ? 'Official NYT game. Guesses count toward your NYT result.'
                : 'Past puzzle. NYT account stats are unchanged.'}
          </p>
        </>
      )}
      {date === today && (
        <div className="play-actions">
          <button
            disabled={
              busy ||
              session?.canPlay === false ||
              session?.status !== 'playing'
            }
            onClick={() => void action(MessageType.CONNECT_NYT_PLAY)}
          >
            {connected ? 'Sync NYT' : 'Connect NYT'}
          </button>
          <button
            disabled={busy}
            onClick={() => void action(MessageType.OPEN_NYT_PLAY_TAB)}
          >
            Open NYT
          </button>
        </div>
      )}
      <div className="play-feedback">
        {statusMessage && (!controlsOnly || !error) && (
          <div className="play-message" role="status" aria-live="polite">
            {statusMessage}
            {(session?.answer || completedDetails?.solution) &&
              ` Answer: ${session?.answer || completedDetails?.solution}`}
          </div>
        )}
        {error && (
          <p className="play-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {invalidGuess?.date === date && (
        <span
          className="play-validation"
          role="status"
          key={invalidGuess.token}
        >
          {invalidGuess.message}
        </span>
      )}
      {!controlsOnly && (
        <div className="play-board-space">
          <div
            ref={boardRef}
            tabIndex={0}
            className="play-board"
            data-date={date}
            data-ready={session?.date === date && !busy}
            role="group"
            aria-label="Wordle board"
            aria-busy={busy}
            onClick={() => boardRef.current?.focus({ preventScroll: true })}
          >
            {Array.from({ length: 6 }, (_, row) => (
              <div
                className="play-row"
                role="group"
                aria-label={`Guess ${row + 1}`}
                key={row}
              >
                {Array.from({ length: 5 }, (_, column) => {
                  const cell = session?.rows[row]?.[column];
                  const letter =
                    cell?.letter ||
                    (row === session?.rows.length
                      ? session.draft[column] || ''
                      : '');
                  return (
                    <span
                      className="play-cell"
                      key={column}
                      data-state={cell?.status || (letter ? 'tbd' : 'empty')}
                      aria-label={`${letter || 'Empty'}${cell ? `, ${cell.status}` : ''}`}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="play-bottom">
        <div
          className="play-keyboard"
          aria-label="Letter keyboard"
          aria-busy={busy}
          aria-hidden={completed || undefined}
        >
          {keyboard.map((row) => (
            <div key={row}>
              {row === keyboard[2] && (
                <button disabled={disabled} onClick={submit}>
                  Enter
                </button>
              )}
              {[...row].map((letter) => (
                <button
                  key={letter}
                  data-state={states.get(letter)}
                  aria-label={`Type ${letter}${states.has(letter) ? `, ${states.get(letter)}` : ''}`}
                  disabled={disabled}
                  onClick={() => keyHandler.current(letter)}
                >
                  {letter}
                </button>
              ))}
              {row === keyboard[2] && (
                <button
                  aria-label="Backspace"
                  disabled={disabled}
                  onClick={() => keyHandler.current('Backspace')}
                >
                  Del
                </button>
              )}
            </div>
          ))}
        </div>
        {completed && (
          <section
            className="play-completed-summary"
            aria-label="Completed game comparisons"
          >
            <div>
              <span>You</span>
              <strong>
                {session?.status === 'lost' ||
                completedDetails?.attempts === null
                  ? 'X/6'
                  : (completedDetails?.attempts ?? session?.rows.length)}
              </strong>
            </div>
            <div title="Per-puzzle NYT reader average">
              <span>NYT readers</span>
              <strong>
                {Number.isFinite(completedDetails?.nytReaderAverage)
                  ? completedDetails!.nytReaderAverage!.toFixed(2)
                  : 'N/A'}
              </strong>
            </div>
            <div title="Local heuristic solver, normal mode">
              <span>Local solver</span>
              <strong>{solverTurns}</strong>
            </div>
            {completedDetails?.skillScore !== undefined && (
              <div>
                <span>Skill</span>
                <strong>{completedDetails.skillScore}</strong>
              </div>
            )}
            {completedDetails?.luckScore !== undefined && (
              <div>
                <span>Luck</span>
                <strong>{completedDetails.luckScore}</strong>
              </div>
            )}
          </section>
        )}
      </div>
      {controlsOnly && !popout && (
        <div className="play-actions play-popout">
          <button
            disabled={busy || !date}
            onClick={() => void action(MessageType.OPEN_PLAY_WINDOW)}
          >
            Pop out
          </button>
        </div>
      )}
    </main>
  );
};

export default GamePlay;
