import { isIanaTimeZone } from './timezone.js';

describe('isIanaTimeZone', () => {
  it('accepts an IANA name and rejects a blank zone', () => {
    expect(isIanaTimeZone('UTC')).toBe(true);
    expect(isIanaTimeZone('Europe/Sofia')).toBe(true);
    expect(isIanaTimeZone('Not/AZone')).toBe(false);
  });
});
