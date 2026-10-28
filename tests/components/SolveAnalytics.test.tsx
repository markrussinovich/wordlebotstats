import { fireEvent, render, screen, within } from '@testing-library/react';
import SolveAnalytics from '@/dashboard/components/SolveAnalytics';
import { useGameDataStore } from '@/stores/gameData';

it('shows missing readers honestly and saves a per-puzzle reader mean only after storage acknowledges it', async () => {
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
  fireEvent.change(
    within(tile).getByLabelText("NYT readers' average for 2026-10-25"),
    { target: { value: '3.82' } }
  );
  fireEvent.click(
    within(tile).getByRole('button', { name: 'Save reader average' })
  );
  await screen.findByText('Save reader average');
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      gameResult: expect.objectContaining({
        date: '2026-10-25',
        nytReaderAverage: 3.82,
        nytReaderSource: 'manual',
      }),
    })
  );
  expect(useGameDataStore.getState().games[0].nytReaderAverage).toBe(3.82);
});
