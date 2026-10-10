import { describe, expect, it } from 'vitest';
import {
  affectedCountryNames,
  countriesOnLane,
  hazardLead,
  isCentroidEvent,
} from './disaster-place.js';

describe('continental disaster placement', () => {
  const properties = {
    Class: 'Point_Centroid',
    polygonlabel: 'Centroid',
    affectedcountries: [
      { iso2: 'DE', countryname: 'Germany' },
      { iso2: 'AT', countryname: 'Austria' },
      { iso2: 'FR', countryname: 'France' },
    ],
  };

  it('treats a GDACS centroid as a wide event', () => {
    expect(isCentroidEvent(properties)).toBe(true);
    expect(affectedCountryNames(properties)).toEqual([
      'Germany',
      'Austria',
      'France',
    ]);
  });

  it('keeps only the lane ends that are in the country list', () => {
    expect(
      countriesOnLane(['Germany', 'Austria', 'France'], 'Germany', 'Bulgaria'),
    ).toEqual([{ place: 'origin', country: 'Germany' }]);
    expect(hazardLead('Drought in Austria, Germany, France')).toBe('Drought');
  });
});
