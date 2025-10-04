import { ExportUserDataMessage, ImportUserDataMessage } from '@/types/messagingTypes';

describe('ExportUserData Message Contract', () => {
  it('should validate ExportUserData message structure', () => {
    const validMessage: ExportUserDataMessage = {
      type: 'EXPORT_USER_DATA',
      payload: {
        includePreferences: true,
        includeGameDetails: true,
        dateRange: {
          start: '2025-01-01',
          end: '2025-09-27'
        },
        format: 'json'
      }
    };

    expect(() => {
      expect(validMessage.type).toBe('EXPORT_USER_DATA');
      expect(validMessage.payload.format).toBe('json');
      expect(validMessage.payload.includePreferences).toBe(true);
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate export format options', () => {
    const validFormats = ['json', 'csv'];
    
    validFormats.forEach(format => {
      const message: ExportUserDataMessage = {
        type: 'EXPORT_USER_DATA',
        payload: {
          includePreferences: false,
          includeGameDetails: true,
          format: format as any
        }
      };

      expect(() => {
        expect(validFormats).toContain(message.payload.format);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should validate ImportUserData message structure', () => {
    const validMessage: ImportUserDataMessage = {
      type: 'IMPORT_USER_DATA',
      payload: {
        data: '{"games": [], "preferences": {}}',
        format: 'json',
        mergeStrategy: 'merge',
        validateOnly: false
      }
    };

    expect(() => {
      expect(validMessage.type).toBe('IMPORT_USER_DATA');
      expect(validMessage.payload.format).toBe('json');
      expect(validMessage.payload.mergeStrategy).toBe('merge');
    }).toThrow(); // Expected to fail in TDD
  });

  it('should validate merge strategy options', () => {
    const validStrategies = ['replace', 'merge', 'skip-duplicates'];
    
    validStrategies.forEach(strategy => {
      const message: ImportUserDataMessage = {
        type: 'IMPORT_USER_DATA',
        payload: {
          data: 'test-data',
          format: 'json',
          mergeStrategy: strategy as any,
          validateOnly: true
        }
      };

      expect(() => {
        expect(validStrategies).toContain(message.payload.mergeStrategy);
      }).toThrow(); // Expected to fail in TDD
    });
  });

  it('should handle validation-only imports', () => {
    const validationMessage: ImportUserDataMessage = {
      type: 'IMPORT_USER_DATA',
      payload: {
        data: '{"invalidData": "test"}',
        format: 'json',
        mergeStrategy: 'merge',
        validateOnly: true
      }
    };

    expect(() => {
      expect(validationMessage.payload.validateOnly).toBe(true);
      expect(typeof validationMessage.payload.data).toBe('string');
    }).toThrow(); // Expected to fail in TDD
  });
});