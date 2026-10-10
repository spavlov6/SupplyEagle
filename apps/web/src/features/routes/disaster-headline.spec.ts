import { describe, expect, it } from 'vitest';
import { focusDisasterHeadline } from './disaster-headline';

const europe =
  'Drought in Austria, Bosnia and Herzegovina, Belgium, Belarus, Switzerland, Czech Republic, Germany, Denmark, Spain, France, Croatia, Hungary, Ireland, Italy, Liechtenstein, Luxembourg, Moldova, Montenegro, Netherlands, Norway, Poland, Romania, Serbia, Russia, Sweden, Slovenia, Slovakia, San Marino,';

describe('focusDisasterHeadline', () => {
  it('keeps only the lane country from a continental list', () => {
    expect(focusDisasterHeadline(europe, 'Germany')).toBe('Drought in Germany');
  });

  it('does not list the continent when the lane country is absent', () => {
    expect(focusDisasterHeadline(europe, 'Bulgaria')).toBe(
      'Drought across a wide area',
    );
  });

  it('leaves a local headline unchanged', () => {
    expect(focusDisasterHeadline('Flood in Munich', 'Germany')).toBe(
      'Flood in Munich',
    );
  });
});
