import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SolveAnalytics from '@/dashboard/components/SolveAnalytics';
import { useGameDataStore } from '@/stores/gameData';

beforeEach(() => {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  (chrome.runtime.getURL as jest.Mock).mockImplementation((file) => `chrome-extension://test/${file}`);
});

it('shows missing readers as N/A without offering a manual reader-average form', () => {
  const game = {
    date: '2026-10-25',
    attempts: 4,
    won: true,
    hardMode: false,
    solution: 'SLATE',
  };
  useGameDataStore.getState().clearAllGames();
  useGameDataStore.getState().addGame(game);
  (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
    success: true,
  });
  render(
    <SolveAnalytics
      games={[game]}
      solver={{
        running: false,
        error: null,
        results: { SLATE: { status: 'solved', turns: 1, guesses: [] } },
      }}
    />
  );
  const tile = screen.getByText('2026-10-25').closest('details')!;
  expect(within(tile).getByText('N/A')).toBeInTheDocument();
  expect(within(tile).getByText('Solver')).toBeInTheDocument();
  expect(within(tile).getByText('NYT readers')).toBeInTheDocument();
  expect(within(tile).queryByRole('spinbutton')).toBeNull();
  expect(screen.queryByRole('button', { name: /reader average/i })).toBeNull();
});

it('shows unplayed dates only when enabled, respects the selected date range and hides their answers', async () => {
  const games = [{
    date: '2026-10-23', attempts: 3, won: true, hardMode: false, solution: 'SLATE',
  }, {
    date: '2026-10-25', attempts: 0, won: false, hardMode: false, solution: 'APPLE',
  }];
  useGameDataStore.getState().clearAllGames();
  useGameDataStore.getState().addGames(games);
  (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({ success: true });
  render(<SolveAnalytics games={[]} allGames={games}
    dateRange={{ start: '2026-10-24', end: '2026-10-25' }}
    solver={{ running: false, error: null, results: {} }} />);
  await waitFor(() => expect(screen.getByLabelText('Show unplayed')).not.toBeChecked());
  expect(screen.queryByText('2026-10-25')).toBeNull();
  fireEvent.click(screen.getByLabelText('Show unplayed'));
  expect(screen.getByText('2026-10-24')).toBeInTheDocument();
  expect(screen.getByText('2026-10-25')).toBeInTheDocument();
  expect(screen.queryByText('2026-10-23')).toBeNull();
  expect(screen.queryByText('2026-10-26')).toBeNull();
  expect(screen.queryByText(/Answer:/)).toBeNull();
  expect(screen.queryByRole('link', { name: 'Play' })).toBeNull();
  expect(screen.getAllByLabelText(/Unplayed board/)).toHaveLength(2);
  for (const date of ['2026-10-24', '2026-10-25']) {
    const summary = screen.getByText(date).closest('summary')!;
    expect(within(summary).queryByText('Solver')).toBeNull();
    expect(within(summary).queryByText('NYT readers')).toBeNull();
  }
  expect(useGameDataStore.getState().games).toEqual(games);
  expect(chrome.storage.local.set).toHaveBeenCalledWith({ wordleShowUnplayed: true });
  const tile = screen.getByText('2026-10-24').closest('details')!;
  tile.open = true;
  fireEvent(tile, new Event('toggle'));
  await waitFor(() => expect(screen.getByTitle('Play Wordle 2026-10-24'))
    .toHaveAttribute('src', 'chrome-extension://test/popup.html?embedded=1&date=2026-10-24'));
});

it('applies reader responses together after the batch, including when a request fails', async () => {
  const games = ['2026-10-23', '2026-10-24', '2026-10-25'].map((date) => ({
    date,
    attempts: 4,
    won: true,
    hardMode: false,
    solution: 'SLATE',
  }));
  useGameDataStore.getState().clearAllGames();
  useGameDataStore.getState().addGames(games);
  const responses: Array<{
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }> = [];
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
    () => new Promise((resolve, reject) => responses.push({ resolve, reject }))
  );
  const ConnectedAnalytics = () => {
    const storedGames = useGameDataStore((state) => state.games);
    return (
      <SolveAnalytics
        games={storedGames}
        solver={{ running: false, error: null, results: {} }}
      />
    );
  };
  render(<ConnectedAnalytics />);
  await waitFor(() => expect(responses).toHaveLength(1));
  await act(async () => {
    responses[0].resolve({
      success: true,
      game: {
        ...games[2],
        nytReaderAverage: 4.2,
        nytReaderSource: 'wordlebot',
      },
    });
  });
  expect(responses).toHaveLength(2);
  expect(screen.queryByText('4.20')).toBeNull();
  expect(useGameDataStore.getState().games).toEqual(games);
  await act(async () => {
    responses[1].reject(new Error('Reader summary unavailable'));
  });
  expect(responses).toHaveLength(3);
  expect(screen.queryByText('4.20')).toBeNull();
  await act(async () => {
    responses[2].resolve({
      success: true,
      game: {
        ...games[0],
        nytReaderAverage: 3.8,
        nytReaderSource: 'wordlebot',
      },
    });
  });
  expect(screen.getByText('4.20')).toBeInTheDocument();
  expect(screen.getByText('3.80')).toBeInTheDocument();
  expect(useGameDataStore.getState().games[1]).toEqual(games[1]);
});

it('retries an interrupted batch without applying stale reader responses', async () => {
  const game = {
    date: '2026-10-25',
    attempts: 4,
    won: true,
    hardMode: false,
    solution: 'SLATE',
  };
  useGameDataStore.getState().clearAllGames();
  useGameDataStore.getState().addGame(game);
  const responses: Array<(value: unknown) => void> = [];
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
    () => new Promise((resolve) => responses.push(resolve))
  );
  const solver = { running: false, error: null, results: {} };
  const { rerender } = render(
    <SolveAnalytics games={[game]} solver={solver} />
  );
  rerender(<SolveAnalytics games={[{ ...game }]} solver={solver} />);
  expect(responses).toHaveLength(2);
  await act(async () => {
    responses[0]({
      success: true,
      game: { ...game, nytReaderAverage: 3.8, nytReaderSource: 'wordlebot' },
    });
  });
  expect(useGameDataStore.getState().games).toEqual([game]);
  await act(async () => {
    responses[1]({
      success: true,
      game: { ...game, nytReaderAverage: 4.2, nytReaderSource: 'wordlebot' },
    });
  });
  expect(useGameDataStore.getState().games[0].nytReaderAverage).toBe(4.2);
});
