import { render, screen, within } from '@testing-library/react';
import SolveAnalytics from '@/dashboard/components/SolveAnalytics';
import { useGameDataStore } from '@/stores/gameData';

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
  expect(within(tile).queryByRole('spinbutton')).toBeNull();
  expect(screen.queryByRole('button', { name: /reader average/i })).toBeNull();
});