import { agreePlaces, type GeoPoint } from './geo.js';
import {
  asNumber,
  asString,
  errorMessage,
  isRecord,
  requestJson,
} from './http.js';

export type LocatedPlace = GeoPoint & {
  name: string;
  country: string | null;
};

export class LocateError extends Error {
  constructor(place: string) {
    super(
      `Could not locate ${place}. Open-Meteo and Nominatim must both resolve within 50 km.`,
    );
    this.name = 'LocateError';
  }
}

export async function locatePlace(query: string): Promise<LocatedPlace> {
  let openMeteo: (GeoPoint & { country: string | null }) | null = null;
  let nominatim: GeoPoint | null = null;
  try {
    [openMeteo, nominatim] = await Promise.all([
      geocodeOpenMeteo(query),
      geocodeNominatim(query),
    ]);
  } catch (error) {
    throw new LocateError(
      `${query}: ${errorMessage(error, 'geocoder request failed')}`,
    );
  }

  const agreed = agreePlaces(openMeteo, nominatim);
  if (!agreed) {
    throw new LocateError(query);
  }

  return { ...agreed, name: query, country: openMeteo?.country ?? null };
}

async function geocodeOpenMeteo(
  query: string,
): Promise<(GeoPoint & { country: string | null }) | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const body = await requestJson(url.toString());
  const result =
    isRecord(body) && Array.isArray(body.results) ? body.results[0] : null;
  if (!isRecord(result)) {
    return null;
  }

  const lat = asNumber(result.latitude);
  const lon = asNumber(result.longitude);
  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon, country: asString(result.country) };
}

async function geocodeNominatim(query: string): Promise<GeoPoint | null> {
  return withNominatim(() => requestNominatim(query));
}

let nominatimChain: Promise<void> = Promise.resolve();

function withNominatim<T>(run: () => Promise<T>): Promise<T> {
  const execute = nominatimChain.then(async () => {
    const started = Date.now();
    try {
      return await run();
    } finally {
      const remaining = 1_100 - (Date.now() - started);
      if (remaining > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, remaining);
        });
      }
    }
  });
  nominatimChain = execute.then(
    () => undefined,
    () => undefined,
  );
  return execute;
}

async function requestNominatim(query: string): Promise<GeoPoint | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const body = await requestJson(url.toString());
  const result = Array.isArray(body) ? body[0] : null;
  if (!isRecord(result)) {
    return null;
  }

  const lat = asNumber(asString(result.lat) ?? result.lat);
  const lon = asNumber(asString(result.lon) ?? result.lon);
  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
}
