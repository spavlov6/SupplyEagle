import type { ShippingMode } from '@supplyeagle/types';
import type { LocatedPlace } from './geocode.js';
import { asNumber, errorMessage, isRecord, requestJson } from './http.js';
import type { LaneEnd, WeatherProvider, WeatherReading } from './signals.js';

export async function fetchOpenMeteo(
  mode: ShippingMode,
  origin: LocatedPlace,
  destination: LocatedPlace,
): Promise<{ readings: WeatherReading[]; error: string | null }> {
  return fetchPair('open_meteo', mode, origin, destination, readOpenMeteo);
}

export async function fetchMetNorway(
  mode: ShippingMode,
  origin: LocatedPlace,
  destination: LocatedPlace,
): Promise<{ readings: WeatherReading[]; error: string | null }> {
  return fetchPair('met_norway', mode, origin, destination, readMetNorway);
}

async function fetchPair(
  provider: WeatherProvider,
  mode: ShippingMode,
  origin: LocatedPlace,
  destination: LocatedPlace,
  read: (mode: ShippingMode, place: LaneEnd, point: LocatedPlace) => Promise<WeatherReading>,
): Promise<{ readings: WeatherReading[]; error: string | null }> {
  const ends: Array<{ end: LaneEnd; point: LocatedPlace }> = [
    { end: 'origin', point: origin },
    { end: 'destination', point: destination },
  ];
  const readings: WeatherReading[] = [];
  const errors: string[] = [];
  for (const end of ends) {
    try {
      readings.push(await read(mode, end.end, end.point));
    } catch (error) {
      errors.push(errorMessage(error, `${provider} request failed`));
    }
  }

  if (readings.length === 0) {
    return { readings: [], error: errors[0] ?? `${provider} request failed` };
  }

  return { readings, error: null };
}

async function readOpenMeteo(
  mode: ShippingMode,
  place: LaneEnd,
  point: LocatedPlace,
): Promise<WeatherReading> {
  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', String(point.lat));
  forecastUrl.searchParams.set('longitude', String(point.lon));
  forecastUrl.searchParams.set('current', 'wind_speed_10m,visibility');
  forecastUrl.searchParams.set('wind_speed_unit', 'kmh');
  forecastUrl.searchParams.set('timezone', 'UTC');
  const forecast = await requestJson(forecastUrl.toString());
  const current = isRecord(forecast) && isRecord(forecast.current) ? forecast.current : null;
  let waveHeightM: number | null = null;
  if (mode === 'sea') {
    waveHeightM = await openMeteoWaves(point);
  }

  return {
    provider: 'open_meteo',
    place,
    windKmh: asNumber(current?.wind_speed_10m),
    visibilityM: asNumber(current?.visibility),
    waveHeightM,
  };
}

async function openMeteoWaves(point: LocatedPlace): Promise<number | null> {
  const url = new URL('https://marine-api.open-meteo.com/v1/marine');
  url.searchParams.set('latitude', String(point.lat));
  url.searchParams.set('longitude', String(point.lon));
  url.searchParams.set('current', 'wave_height');
  url.searchParams.set('timezone', 'UTC');
  try {
    const body = await requestJson(url.toString());
    if (!isRecord(body) || !isRecord(body.current)) {
      return null;
    }

    return asNumber(body.current.wave_height);
  } catch {
    return null;
  }
}

async function readMetNorway(
  mode: ShippingMode,
  place: LaneEnd,
  point: LocatedPlace,
): Promise<WeatherReading> {
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
  url.searchParams.set('lat', point.lat.toFixed(4));
  url.searchParams.set('lon', point.lon.toFixed(4));
  const body = await requestJson(url.toString());
  const details = firstDetails(body);
  let waveHeightM: number | null = null;
  if (mode === 'sea') {
    waveHeightM = await metNorwayWaves(point);
  }

  const windMs = asNumber(details?.wind_speed);
  return {
    provider: 'met_norway',
    place,
    windKmh: windMs === null ? null : windMs * 3.6,
    visibilityM: asNumber(details?.visibility) ?? asNumber(details?.visibility_in_air),
    waveHeightM,
  };
}

async function metNorwayWaves(point: LocatedPlace): Promise<number | null> {
  const url = new URL('https://api.met.no/weatherapi/oceanforecast/2.0/complete');
  url.searchParams.set('lat', point.lat.toFixed(4));
  url.searchParams.set('lon', point.lon.toFixed(4));
  try {
    const body = await requestJson(url.toString());
    return asNumber(firstDetails(body)?.sea_surface_wave_height);
  } catch {
    return null;
  }
}

function firstDetails(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body) || !isRecord(body.properties) || !Array.isArray(body.properties.timeseries)) {
    return null;
  }

  const first = body.properties.timeseries[0];
  if (!isRecord(first) || !isRecord(first.data) || !isRecord(first.data.instant)) {
    return null;
  }

  return isRecord(first.data.instant.details) ? first.data.instant.details : null;
}
