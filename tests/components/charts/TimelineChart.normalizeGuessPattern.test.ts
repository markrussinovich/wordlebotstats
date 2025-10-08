import { __timelineChartTestUtils } from '@/components/charts/TimelineChart';

describe('TimelineChart guess pattern normalization', () => {
  const { normalizeGuessPattern } = __timelineChartTestUtils;

  it('passes through already normalized GuessResult objects', () => {
    const pattern = [
      [
        { letter: 'A', status: 'correct' as const },
        { letter: 'M', status: 'present' as const },
        { letter: 'U', status: 'absent' as const }
      ]
    ];

    const normalized = normalizeGuessPattern(pattern);
    expect(normalized).toEqual(pattern);
  });

  it('normalizes legacy status strings', () => {
    const pattern = [
      ['correct', 'present', 'wrong']
    ];

    const normalized = normalizeGuessPattern(pattern);
    expect(normalized).toEqual([
      [
        { letter: '', status: 'correct' },
        { letter: '', status: 'present' },
        { letter: '', status: 'absent' }
      ]
    ]);
  });

  it('normalizes emoji share text rows', () => {
    const pattern = ['🟩🟨⬛⬛⬛'];

    const normalized = normalizeGuessPattern(pattern);
    expect(normalized).toEqual([
      [
        { letter: '', status: 'correct' },
        { letter: '', status: 'present' },
        { letter: '', status: 'absent' },
        { letter: '', status: 'absent' },
        { letter: '', status: 'absent' }
      ]
    ]);
  });

  it('normalizes legacy objects with state/result fields', () => {
    const pattern = [
      [
        { value: 'A', state: 'CorrectPosition' },
        { value: 'M', result: 'present' },
        { value: 'U', status: 'absent' }
      ]
    ];

    const normalized = normalizeGuessPattern(pattern);
    expect(normalized).toEqual([
      [
        { letter: 'A', status: 'correct' },
        { letter: 'M', status: 'present' },
        { letter: 'U', status: 'absent' }
      ]
    ]);
  });
});
