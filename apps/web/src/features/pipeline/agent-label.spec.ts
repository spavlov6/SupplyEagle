import { describe, expect, it } from 'vitest';
import { firstSentences, formatClock, formatCountdown } from './agent-label';

describe('scan clock', () => {
  it('formats the saved time and a countdown', () => {
    expect(formatClock(8, 0)).toBe('08:00');
    expect(formatClock(8, 5)).toBe('08:05');
    const now = Date.parse('2026-10-10T06:00:00.000Z');
    expect(formatCountdown('2026-10-10T08:00:05.000Z', now)).toBe('2h 00m 05s');
    expect(formatCountdown('2026-10-10T05:00:00.000Z', now)).toBeNull();
  });

  it('keeps the first two sentences', () => {
    expect(
      firstSentences(
        'One alert. Two routes are elevated. Review the supplier.',
        2,
      ),
    ).toBe('One alert. Two routes are elevated.');
  });
});
