import { parseWikidata } from './wikidata.js';

describe('parseWikidata', () => {
  it('reads an organization whose English label matches the supplier', () => {
    expect(
      parseWikidata(
        {
          results: {
            bindings: [
              {
                item: {
                  type: 'uri',
                  value: 'https://www.wikidata.org/entity/Q81230',
                },
                itemLabel: { type: 'literal', value: 'Siemens' },
                countryLabel: { type: 'literal', value: 'Germany' },
              },
            ],
          },
        },
        'Siemens AG',
      ),
    ).toMatchObject({
      status: 'found',
      label: 'Siemens',
      url: 'https://www.wikidata.org/entity/Q81230',
      facts: {
        legalName: 'Siemens',
        country: 'Germany',
        sanctionsHit: null,
        matched: true,
      },
    });
  });
});
