import { GameResult, GuessResult } from '@/types/gameTypes';

describe('GameResult Model', () => {
  const mockGuessPattern: GuessResult[][] = [
    [
      { letter: 'S', status: 'present' },
      { letter: 'T', status: 'absent' },
      { letter: 'A', status: 'correct' },
      { letter: 'R', status: 'present' },
      { letter: 'E', status: 'correct' }
    ]
  ];

  it('should validate GameResult structure for winning game', () => {
    const winningGame: GameResult = {
      gameId: 'game-123-2025-09-27',
      date: '2025-09-27T10:00:00Z',
      puzzleNumber: 123,
      completed: true,
      won: true,
      attempts: 4,
      hardMode: false,
      guessPattern: mockGuessPattern,
      timeToComplete: 180,
      streakActive: true,
      importedAt: '2025-09-27T10:05:00Z'
    };

    expect(() => {
      expect(winningGame.gameId).toBe('game-123-2025-09-27');
      expect(winningGame.won).toBe(true);
      expect(winningGame.attempts).toBe(4);
      expect(winningGame.guessPattern).toHaveLength(1);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate GameResult structure for failed game', () => {
    const failedGame: GameResult = {
      gameId: 'game-124-2025-09-28',
      date: '2025-09-28T11:00:00Z',
      puzzleNumber: 124,
      completed: true,
      won: false,
      attempts: null, // Failed games have null attempts
      hardMode: true,
      guessPattern: [],
      streakActive: false,
      importedAt: '2025-09-28T11:05:00Z'
    };

    expect(() => {
      expect(failedGame.won).toBe(false);
      expect(failedGame.attempts).toBeNull();
      expect(failedGame.streakActive).toBe(false);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate GuessResult status values', () => {
    const validStatuses = ['correct', 'present', 'absent'];
    
    validStatuses.forEach(status => {
      const guessResult: GuessResult = {
        letter: 'A',
        status: status as any
      };

      expect(() => {
        expect(validStatuses).toContain(guessResult.status);
        expect(guessResult.letter).toMatch(/^[A-Z]$/);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate date formats', () => {
    const gameWithValidDate: GameResult = {
      gameId: 'game-125',
      date: '2025-09-27T10:00:00.000Z',
      puzzleNumber: 125,
      completed: true,
      won: true,
      attempts: 3,
      hardMode: false,
      guessPattern: mockGuessPattern,
      streakActive: true,
      importedAt: '2025-09-27T10:05:00.000Z'
    };

    expect(() => {
      expect(gameWithValidDate.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(gameWithValidDate.date).getTime()).toBeGreaterThan(0);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate attempts range for completed games', () => {
    const validAttempts = [1, 2, 3, 4, 5, 6, null]; // null for failed games
    
    validAttempts.forEach(attempts => {
      const game: GameResult = {
        gameId: `game-${attempts || 'failed'}`,
        date: '2025-09-27T10:00:00Z',
        puzzleNumber: 126,
        completed: true,
        won: attempts !== null,
        attempts: attempts,
        hardMode: false,
        guessPattern: attempts ? mockGuessPattern : [],
        streakActive: attempts !== null,
        importedAt: '2025-09-27T10:05:00Z'
      };

      expect(() => {
        if (attempts !== null) {
          expect(attempts).toBeGreaterThanOrEqual(1);
          expect(attempts).toBeLessThanOrEqual(6);
        } else {
          expect(game.won).toBe(false);
        }
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate puzzle number is positive integer', () => {
    const gameWithPuzzleNumber: GameResult = {
      gameId: 'game-999',
      date: '2025-09-27T10:00:00Z',
      puzzleNumber: 999,
      completed: true,
      won: true,
      attempts: 2,
      hardMode: false,
      guessPattern: mockGuessPattern,
      streakActive: true,
      importedAt: '2025-09-27T10:05:00Z'
    };

    expect(() => {
      expect(gameWithPuzzleNumber.puzzleNumber).toBeGreaterThan(0);
      expect(Number.isInteger(gameWithPuzzleNumber.puzzleNumber)).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });
});