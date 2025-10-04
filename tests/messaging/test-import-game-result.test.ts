import { ImportGameResultMessage, GuessResult } from '@/types/messagingTypes';

describe('ImportGameResult Message Contract', () => {
  it('should validate ImportGameResult message structure', () => {
    const mockGuessPattern: GuessResult[][] = [
      [
        { letter: 'A', status: 'correct' },
        { letter: 'B', status: 'present' },
        { letter: 'C', status: 'absent' },
        { letter: 'D', status: 'present' },
        { letter: 'E', status: 'correct' }
      ]
    ];

    const validMessage: ImportGameResultMessage = {
      type: 'IMPORT_GAME_RESULT',
      payload: {
        puzzleNumber: 123,
        date: '2025-09-27T10:00:00Z',
        won: true,
        attempts: 4,
        hardMode: false,
        guessPattern: mockGuessPattern,
        timeToComplete: 180
      }
    };

    // Test message validation - should fail until types are implemented
    expect(() => {
      // This will fail until we implement the types
      const message = validMessage as ImportGameResultMessage;
      expect(message.type).toBe('IMPORT_GAME_RESULT');
      expect(message.payload.puzzleNumber).toBe(123);
      expect(message.payload.won).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate GuessResult structure', () => {
    const validGuessResult: GuessResult = {
      letter: 'A',
      status: 'correct'
    };

    // Test guess result validation - should fail until types are implemented  
    expect(() => {
      expect(validGuessResult.letter).toBe('A');
      expect(validGuessResult.status).toBe('correct');
      expect(['correct', 'present', 'absent']).toContain(validGuessResult.status);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should handle failed game imports', () => {
    const failedGameMessage: ImportGameResultMessage = {
      type: 'IMPORT_GAME_RESULT',
      payload: {
        puzzleNumber: 124,
        date: '2025-09-27T11:00:00Z',
        won: false,
        attempts: null, // Failed game has null attempts
        hardMode: true,
        guessPattern: []
      }
    };

    expect(() => {
      expect(failedGameMessage.payload.won).toBe(false);
      expect(failedGameMessage.payload.attempts).toBeNull();
    }).toThrow(); // Expected to fail in TDD
  });
});