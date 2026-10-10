import { assessConfidence, type ConfidenceCheck } from './confidence.js';
import { namesCompatible } from './names.js';

function check(
  source: ConfidenceCheck['source'],
  status: ConfidenceCheck['status'],
  facts: ConfidenceCheck['facts'],
): ConfidenceCheck {
  return { source, status, facts };
}

const germany = {
  legalName: 'Siemens Aktiengesellschaft',
  country: 'DE',
  sanctionsHit: null,
  matched: true,
};

const germanyWiki = {
  legalName: 'Siemens',
  country: 'Germany',
  sanctionsHit: null,
  matched: true,
};

const clearScreen = check('opensanctions', 'not_found', {
  legalName: null,
  country: null,
  sanctionsHit: false,
  matched: false,
});

describe('assessConfidence', () => {
  it('verifies a supplier when GLEIF and Wikidata agree on country', () => {
    expect(
      assessConfidence([
        clearScreen,
        check('gleif', 'found', germany),
        check('wikidata', 'found', germanyWiki),
      ]),
    ).toEqual({
      confidence: 'verified',
      legalName: 'Siemens Aktiengesellschaft',
      country: 'Germany',
      sanctionsHit: false,
    });
  });

  it('marks a single identity source as partial', () => {
    expect(
      assessConfidence([
        clearScreen,
        check('gleif', 'found', germany),
        check('wikidata', 'not_found', null),
      ]),
    ).toEqual({
      confidence: 'partial',
      legalName: 'Siemens Aktiengesellschaft',
      country: 'Germany',
      sanctionsHit: false,
    });
  });

  it('marks disagreeing countries as conflicting', () => {
    expect(
      assessConfidence([
        clearScreen,
        check('gleif', 'found', germany),
        check('wikidata', 'found', { ...germanyWiki, country: 'France' }),
      ]),
    ).toEqual({
      confidence: 'conflicting',
      legalName: null,
      country: null,
      sanctionsHit: false,
    });
  });

  it('stays unverified when neither identity source matches', () => {
    expect(
      assessConfidence([
        check('opensanctions', 'found', {
          legalName: 'Other Siemens',
          country: 'DE',
          sanctionsHit: true,
          matched: true,
        }),
        check('gleif', 'not_found', null),
        check('wikidata', 'not_found', null),
      ]),
    ).toEqual({
      confidence: 'unverified',
      legalName: null,
      country: null,
      sanctionsHit: true,
    });
  });
});

describe('namesCompatible', () => {
  it('ignores equivalent legal suffixes and keeps different ones apart', () => {
    expect(namesCompatible('Siemens AG', 'Siemens Aktiengesellschaft')).toBe(true);
    expect(namesCompatible('Nordwind Hydraulik GmbH', 'Nordwind Hydraulik')).toBe(true);
    expect(namesCompatible('Siemens AG', 'SIEMENS AS')).toBe(false);
    expect(namesCompatible('Siemens AG', 'Siemens Aktiebolag')).toBe(false);
    expect(namesCompatible('Siemens Energy', 'Siemens')).toBe(false);
  });
});
