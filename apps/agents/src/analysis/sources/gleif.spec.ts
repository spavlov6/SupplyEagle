import { parseGleif, selectFuzzyLei } from './gleif.js';

describe('parseGleif', () => {
  it('reads the legal name, country, and LEI for a matching record', () => {
    expect(
      parseGleif(
        {
          data: [
            {
              id: '529900T8BM49AURSDO55',
              attributes: {
                lei: '529900T8BM49AURSDO55',
                entity: {
                  legalName: { name: 'Siemens Aktiengesellschaft' },
                  legalAddress: {
                    addressLines: ['Werner-von-Siemens-Str. 1'],
                    city: 'München',
                    country: 'DE',
                    postalCode: '80333',
                  },
                  registeredAs: 'HRB 6684',
                  creationDate: '1996-08-27T22:00:00Z',
                  status: 'ACTIVE',
                },
              },
            },
          ],
        },
        'Siemens AG',
      ),
    ).toMatchObject({
      status: 'found',
      label: 'Siemens Aktiengesellschaft',
      url: 'https://search.gleif.org/#/record/529900T8BM49AURSDO55',
      facts: {
        legalName: 'Siemens Aktiengesellschaft',
        country: 'DE',
        sanctionsHit: null,
        matched: true,
        lei: '529900T8BM49AURSDO55',
        city: 'München',
        address: 'Werner-von-Siemens-Str. 1, 80333',
        registrationNumber: 'HRB 6684',
        founded: '1996',
        entityStatus: 'ACTIVE',
      },
    });
  });
});

describe('selectFuzzyLei', () => {
  it('skips a different legal form and keeps the equivalent one', () => {
    expect(
      selectFuzzyLei(
        {
          data: [
            fuzzy('SIEMENS AS', '529900L2BY5305IPCH19'),
            fuzzy('Siemens Aktiengesellschaft', 'W38RGI023J3WT1HWRP32'),
          ],
        },
        'Siemens AG',
      ),
    ).toBe('W38RGI023J3WT1HWRP32');
  });
});

function fuzzy(value: string, lei: string) {
  return {
    attributes: { value },
    relationships: { 'lei-records': { data: { id: lei } } },
  };
}
