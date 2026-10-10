import { agreePlaces, haversineKm, transitDays } from './geo.js';
import { assessRouteRisk } from './risk.js';
import {
  EXTREME_WIND_KMH,
  STORM_WIND_KMH,
  confirmDisasters,
  confirmWeather,
  confirmedNews,
  type DisasterReport,
  type NewsReport,
  type WeatherReading,
} from './signals.js';

function news(overrides: Partial<NewsReport> & Pick<NewsReport, 'provider' | 'domains'>): NewsReport {
  return {
    place: 'origin',
    hazard: 'closure',
    headline: 'Port closed',
    ...overrides,
  };
}

const placeNames = { origin: 'Shanghai', destination: 'Rotterdam' };

function wind(provider: WeatherReading['provider'], windKmh: number): WeatherReading {
  return {
    provider,
    place: 'origin',
    windKmh,
    waveHeightM: null,
    visibilityM: null,
  };
}

describe('place agreement', () => {
  it('accepts two geocoders within 50 km and rejects a wider split', () => {
    const origin = { lat: 31.23, lon: 121.47 };
    const nearby = { lat: 31.53, lon: 121.47 };
    const far = { lat: 31.93, lon: 121.47 };

    expect(haversineKm(origin, nearby)).toBeLessThan(50);
    expect(haversineKm(origin, far)).toBeGreaterThan(50);
    expect(agreePlaces(origin, nearby)).toEqual({
      lat: (origin.lat + nearby.lat) / 2,
      lon: (origin.lon + nearby.lon) / 2,
    });
    expect(agreePlaces(origin, far)).toBeNull();
    expect(agreePlaces(origin, null)).toBeNull();
  });

  it('adds handling to air transit and port time to sea transit', () => {
    expect(transitDays('air', 0)).toBe(1);
    expect(transitDays('sea', 0)).toBe(2);
    expect(transitDays('air', 800 * 24)).toBe(2);
  });
});

describe('news agreement', () => {
  it('keeps one provider unverified even when it lists many domains', () => {
    expect(
      confirmedNews([
        news({
          provider: 'gdelt',
          domains: ['reuters.com', 'bbc.com', 'apnews.com', 'aljazeera.com'],
          headline: 'Fabricated closure',
        }),
      ]),
    ).toEqual([]);
  });

  it('confirms when two providers share a place and hazard across three domains', () => {
    expect(
      confirmedNews([
        news({
          provider: 'gdelt',
          domains: ['reuters.com', 'bbc.com'],
          headline: 'Shanghai port closed',
        }),
        news({
          provider: 'google_news',
          domains: ['apnews.com'],
          headline: 'Closure continues',
        }),
      ]),
    ).toEqual([
      {
        place: 'origin',
        hazard: 'closure',
        headline: 'Shanghai port closed',
        providers: ['gdelt', 'google_news'],
        domains: ['reuters.com', 'bbc.com', 'apnews.com'],
      },
    ]);
  });

  it('stays unverified with one or two publisher domains', () => {
    expect(
      confirmedNews([
        news({ provider: 'gdelt', domains: ['reuters.com'] }),
        news({ provider: 'google_news', domains: ['reuters.com'] }),
      ]),
    ).toEqual([]);

    expect(
      confirmedNews([
        news({ provider: 'gdelt', domains: ['reuters.com'] }),
        news({ provider: 'reliefweb', domains: ['bbc.com'] }),
      ]),
    ).toEqual([]);
  });

  it('does not pool different hazards or places', () => {
    expect(
      confirmedNews([
        news({ provider: 'gdelt', hazard: 'closure', domains: ['a.com', 'b.com', 'c.com'] }),
        news({ provider: 'google_news', hazard: 'strike', domains: ['d.com', 'e.com', 'f.com'] }),
      ]),
    ).toEqual([]);

    expect(
      confirmedNews([
        news({ provider: 'gdelt', place: 'origin', domains: ['a.com', 'b.com'] }),
        news({
          provider: 'google_news',
          place: 'destination',
          domains: ['c.com'],
        }),
      ]),
    ).toEqual([]);
  });
});

describe('weather agreement', () => {
  it('does not raise risk from one provider over the threshold', () => {
    const weather = confirmWeather([wind('open_meteo', EXTREME_WIND_KMH + 20)], placeNames);

    expect(weather).toEqual([]);
    expect(
      assessRouteRisk({ news: [], disasters: [], weather, supplier: null }),
    ).toMatchObject({ laneStatus: 'active', riskState: 'stable' });
  });

  it('raises risk when both weather providers cross the same threshold', () => {
    const weather = confirmWeather(
      [wind('open_meteo', STORM_WIND_KMH), wind('met_norway', STORM_WIND_KMH + 4)],
      placeNames,
    );

    expect(weather).toEqual([
      {
        place: 'origin',
        code: 'wind',
        extreme: false,
        why: 'Severe wind at Shanghai',
      },
    ]);
    expect(
      assessRouteRisk({
        news: [],
        disasters: [],
        weather: weather.map((item) => ({ why: item.why, extreme: item.extreme })),
        supplier: null,
      }),
    ).toMatchObject({ laneStatus: 'active', riskState: 'watch', why: 'Severe wind at Shanghai' });
  });

  it('does not treat different weather codes as agreement', () => {
    expect(
      confirmWeather(
        [
          {
            provider: 'open_meteo',
            place: 'origin',
            windKmh: EXTREME_WIND_KMH,
            waveHeightM: null,
            visibilityM: null,
          },
          {
            provider: 'met_norway',
            place: 'origin',
            windKmh: 10,
            waveHeightM: 8,
            visibilityM: null,
          },
        ],
        placeNames,
      ),
    ).toEqual([]);
  });

  it('marks weather elevated only when both providers are extreme', () => {
    const weather = confirmWeather(
      [wind('open_meteo', EXTREME_WIND_KMH), wind('met_norway', EXTREME_WIND_KMH + 5)],
      placeNames,
    );

    expect(weather[0]?.extreme).toBe(true);
    expect(
      assessRouteRisk({
        news: [],
        disasters: [],
        weather: weather.map((item) => ({ why: item.why, extreme: item.extreme })),
        supplier: null,
      }).riskState,
    ).toBe('elevated');
  });
});

describe('disaster agreement', () => {
  it('does not raise risk from one catalog', () => {
    const disasters = confirmDisasters([
      {
        provider: 'usgs',
        place: 'destination',
        hazardClass: 'earthquake',
        headline: 'M6.2 near Rotterdam',
      },
    ]);

    expect(disasters).toEqual([]);
    expect(
      assessRouteRisk({
        news: [],
        disasters: disasters.map((item) => ({ why: item.headline })),
        weather: [],
        supplier: null,
      }).riskState,
    ).toBe('stable');
  });

  it('raises critical risk when two catalogs match hazard class and place', () => {
    const disasters = confirmDisasters([
      {
        provider: 'usgs',
        place: 'destination',
        hazardClass: 'earthquake',
        headline: 'M6.2 near Rotterdam',
      },
      {
        provider: 'eonet',
        place: 'destination',
        hazardClass: 'earthquakes',
        headline: 'Earthquake near Rotterdam',
      },
    ]);

    expect(disasters).toEqual([
      {
        place: 'destination',
        hazardClass: 'earthquake',
        headline: 'M6.2 near Rotterdam',
        providers: ['usgs', 'eonet'],
      },
    ]);
    expect(
      assessRouteRisk({
        news: [],
        disasters: disasters.map((item) => ({ why: item.headline })),
        weather: [],
        supplier: null,
      }),
    ).toEqual({
      laneStatus: 'disrupted',
      riskState: 'critical',
      why: 'M6.2 near Rotterdam',
    });
  });

  it('does not match different hazard classes', () => {
    const reports: DisasterReport[] = [
      {
        provider: 'usgs',
        place: 'origin',
        hazardClass: 'earthquake',
        headline: 'Quake',
      },
      {
        provider: 'gdacs',
        place: 'origin',
        hazardClass: 'flood',
        headline: 'Flood',
      },
    ];

    expect(confirmDisasters(reports)).toEqual([]);
  });
});
