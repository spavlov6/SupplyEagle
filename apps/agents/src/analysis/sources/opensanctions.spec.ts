import { parseOpenSanctions } from './opensanctions.js';

const hit = {
  responses: {
    supplier: {
      results: [
        {
          id: 'NK-siemens',
          caption: 'Siemens Aktiengesellschaft',
          score: 0.96,
          match: true,
          properties: { country: ['de'] },
        },
      ],
    },
  },
};

describe('parseOpenSanctions', () => {
  it('records a sanctions hit when the name matches', () => {
    expect(parseOpenSanctions(hit, 'Siemens AG')).toMatchObject({
      status: 'found',
      label: 'Siemens Aktiengesellschaft',
      url: 'https://www.opensanctions.org/entities/NK-siemens',
      facts: {
        legalName: 'Siemens Aktiengesellschaft',
        country: 'de',
        sanctionsHit: true,
        matched: true,
      },
    });
  });

  it('ignores a hit whose name does not match the supplier', () => {
    expect(
      parseOpenSanctions(hit, 'Nordwind Hydraulik GmbH').status,
    ).toBe('not_found');
  });
});
