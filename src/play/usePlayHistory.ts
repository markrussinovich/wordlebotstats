import { useEffect, useMemo, useState } from 'react';
import { GameResult } from '../types/gameTypes';
import {
  PLAY_SESSIONS_KEY,
  PLAY_READER_AVERAGES_KEY,
  PlayReaderAverage,
  PlaySession,
} from '../types/playTypes';
import {
  buildGameHistory,
  gamesWithPlaySessions,
  SHOW_UNPLAYED_KEY,
} from '../utils/playHistory';

export function usePlayHistory(games: GameResult[]) {
  const [showUnplayed, setVisible] = useState(false);
  const [sessions, setSessions] = useState<Record<string, PlaySession>>({});
  const [readers, setReaders] = useState<Record<string, PlayReaderAverage>>({});
  useEffect(() => {
    let cancelled = false;
    void chrome.storage.local
      .get([SHOW_UNPLAYED_KEY, PLAY_SESSIONS_KEY, PLAY_READER_AVERAGES_KEY])
      .then((stored) => {
        if (cancelled) return;
        setVisible(stored?.[SHOW_UNPLAYED_KEY] === true);
        if (stored?.[PLAY_SESSIONS_KEY]) setSessions(stored[PLAY_SESSIONS_KEY]);
        if (stored?.[PLAY_READER_AVERAGES_KEY])
          setReaders(stored[PLAY_READER_AVERAGES_KEY]);
      })
      .catch(() => {});
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return;
      if (changes[SHOW_UNPLAYED_KEY])
        setVisible(changes[SHOW_UNPLAYED_KEY].newValue === true);
      if (changes[PLAY_SESSIONS_KEY])
        setSessions(changes[PLAY_SESSIONS_KEY].newValue || {});
      if (changes[PLAY_READER_AVERAGES_KEY])
        setReaders(changes[PLAY_READER_AVERAGES_KEY].newValue || {});
    };
    chrome.storage.onChanged?.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged?.removeListener(listener);
    };
  }, []);
  const history = useMemo(
    () =>
      buildGameHistory(
        gamesWithPlaySessions(games, sessions, readers),
        showUnplayed
      ),
    [games, sessions, readers, showUnplayed]
  );
  const displayGames = useMemo(
    () =>
      gamesWithPlaySessions(
        games,
        Object.fromEntries(
          Object.entries(sessions).filter(
            ([, session]) => session.status !== 'playing'
          )
        ),
        readers
      ),
    [games, sessions, readers]
  );
  return {
    displayGames,
    history,
    showUnplayed,
    setShowUnplayed: (value: boolean) => {
      setVisible(value);
      void chrome.storage.local.set({ [SHOW_UNPLAYED_KEY]: value });
    },
  };
}
