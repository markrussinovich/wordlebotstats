import { GameResult, GuessResult } from './gameTypes';

export const PLAY_SESSIONS_KEY = 'wordlePlaySessions';
export const PLAY_SELECTION_KEY = 'wordlePlaySelection';
export const PLAY_READER_AVERAGES_KEY = 'wordlePlayReaderAverages';
export type PlayReaderAverage = Pick<
  GameResult,
  'nytReaderAverage' | 'nytReaderSource' | 'nytReaderMode'
>;

export interface PlaySession {
  date: string;
  mode: 'replay' | 'live';
  rows: GuessResult[][];
  draft: string;
  draftClient?: string;
  status: 'playing' | 'won' | 'lost';
  answer?: string;
  nytTabId?: number;
  canPlay?: boolean;
}

export interface PlayMessage {
  type: string;
  date?: string;
  guess?: string;
  expectedRows?: number;
  draft?: string;
  client?: string;
  poll?: boolean;
}

export function localPuzzleDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function playStatus(rows: GuessResult[][]): PlaySession['status'] {
  if (
    rows.some(
      (row) =>
        row.length === 5 && row.every((cell) => cell.status === 'correct')
    )
  )
    return 'won';
  return rows.length >= 6 ? 'lost' : 'playing';
}
