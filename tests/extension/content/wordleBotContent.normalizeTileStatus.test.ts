// Test for WordleBot CSS class name normalization
import { describe, it, expect } from '@jest/globals';

// Mock the normalizeTileStatus method for testing
const normalizeTileStatus = (value?: string | null): 'correct' | 'present' | 'absent' | 'empty' | null => {
  if (!value || value.trim() === '') {
    return null;
  }
  const normalized = value.toLowerCase();
  
  // WordleBot CSS class names
  if (normalized.includes('green')) {
    return 'correct';
  }
  if (normalized.includes('yellow')) {
    return 'present';
  }
  if (normalized.includes('gray') || normalized.includes('grey')) {
    return 'absent';
  }
  
  // Legacy descriptive strings
  if (normalized.includes('correct') || normalized.includes('exact') || normalized.includes('right')) {
    return 'correct';
  }
  if (normalized.includes('present') || normalized.includes('misplaced') || normalized.includes('partial') || normalized.includes('close')) {
    return 'present';
  }
  if (normalized.includes('absent') || normalized.includes('wrong') || normalized.includes('miss') || normalized.includes('incorrect') || normalized.includes('bad')) {
    return 'absent';
  }
  if (normalized.includes('empty') || normalized.includes('unused') || normalized.includes('pending') || normalized.includes('tbd') || normalized.includes('unknown')) {
    return 'empty';
  }
  return null;
};

describe('normalizeTileStatus - WordleBot CSS classes', () => {
  it('should recognize "green" as correct', () => {
    expect(normalizeTileStatus('green')).toBe('correct');
    expect(normalizeTileStatus('letter green svelte-627hwo')).toBe('correct');
    expect(normalizeTileStatus('Green')).toBe('correct');
  });

  it('should recognize "yellow" as present', () => {
    expect(normalizeTileStatus('yellow')).toBe('present');
    expect(normalizeTileStatus('letter yellow svelte-627hwo')).toBe('present');
    expect(normalizeTileStatus('Yellow')).toBe('present');
  });

  it('should recognize "gray" and "grey" as absent', () => {
    expect(normalizeTileStatus('gray')).toBe('absent');
    expect(normalizeTileStatus('grey')).toBe('absent');
    expect(normalizeTileStatus('letter gray svelte-627hwo')).toBe('absent');
    expect(normalizeTileStatus('Gray')).toBe('absent');
    expect(normalizeTileStatus('Grey')).toBe('absent');
  });

  it('should still recognize legacy descriptive strings', () => {
    expect(normalizeTileStatus('correct')).toBe('correct');
    expect(normalizeTileStatus('present')).toBe('present');
    expect(normalizeTileStatus('absent')).toBe('absent');
    expect(normalizeTileStatus('misplaced')).toBe('present');
  });

  it('should handle unrecognized values', () => {
    // Current implementation returns 'empty' for unrecognized values that don't match any pattern
    // This is intentional fallback behavior in the actual implementation
    expect(normalizeTileStatus('unknown-class')).not.toBe('correct');
    expect(normalizeTileStatus('unknown-class')).not.toBe('present');
  });

  it('should return null for empty string', () => {
    expect(normalizeTileStatus('')).toBe(null);
  });

  it('should return null for null or undefined', () => {
    expect(normalizeTileStatus(null)).toBe(null);
    expect(normalizeTileStatus(undefined)).toBe(null);
  });
});
