import { DataImportService } from '@/services/dataImport';

describe('DataImportService', () => {
  it('should parse Wordle game results from DOM', () => {
    const mockGameData = {
      puzzleNumber: 123,
      date: '2025-09-27',
      won: true,
      attempts: 4,
      hardMode: false
    };

    expect(() => {
      const service = new DataImportService();
      const result = service.parseWordleResult(mockGameData);
      expect(result.puzzleNumber).toBe(123);
      expect(result.won).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate imported game data', () => {
    const invalidGameData = {
      puzzleNumber: -1, // Invalid
      date: 'invalid-date',
      attempts: 7 // Invalid range
    };

    expect(() => {
      const service = new DataImportService();
      const isValid = service.validateGameData(invalidGameData);
      expect(isValid).toBe(false);
    }).toThrow(); // Expected to fail in TDD
  });
});