import { readClaudeSummary } from './read-claude-summary.js';

describe('readClaudeSummary', () => {
  it('reads a summary from a JSON object', () => {
    expect(readClaudeSummary('{"summary":"GLEIF and Wikidata agree."}')).toBe(
      'GLEIF and Wikidata agree.',
    );
  });

  it('rejects an empty summary', () => {
    expect(() => readClaudeSummary('{"summary":"  "}')).toThrow(
      'Claude did not return a summary',
    );
  });
});
