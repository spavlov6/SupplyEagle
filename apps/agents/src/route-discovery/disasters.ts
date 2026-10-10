import {
  affectedCountryNames,
  countriesOnLane,
  hazardLead,
  isCentroidEvent,
} from './disaster-place.js';
import { haversineKm, type GeoPoint } from './geo.js';
import type { LocatedPlace } from './geocode.js';
import {
  asNumber,
  asString,
  errorMessage,
  isRecord,
  requestJson,
} from './http.js';
import { mentionsPlace } from './news.js';
import { reliefWebAppName } from './reliefweb.js';
import {
  canonicalHazardClass,
  type DisasterProvider,
  type DisasterReport,
  type LaneEnd,
} from './signals.js';

const DISASTER_RADIUS_KM = 300;
const CURRENT_MS = 21 * 24 * 60 * 60 * 1000;

export async function fetchGdacs(
  origin: LocatedPlace,
  destination: LocatedPlace,
): Promise<{ reports: DisasterReport[]; error: string | null }> {
  try {
    const url = new URL(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
    );
    url.searchParams.set('eventlist', 'EQ,TC,FL,VO,WF,DR');
    const body = await requestJson(url.toString());
    return {
      reports: geoJsonReports('gdacs', body, origin, destination),
      error: null,
    };
  } catch (error) {
    return { reports: [], error: errorMessage(error, 'GDACS request failed') };
  }
}

export async function fetchEonet(
  origin: LocatedPlace,
  destination: LocatedPlace,
): Promise<{ reports: DisasterReport[]; error: string | null }> {
  try {
    const url = new URL('https://eonet.gsfc.nasa.gov/api/v3/events');
    url.searchParams.set('status', 'open');
    url.searchParams.set('limit', '80');
    const body = await requestJson(url.toString());
    if (!isRecord(body) || !Array.isArray(body.events)) {
      return { reports: [], error: null };
    }

    const reports: DisasterReport[] = [];
    for (const event of body.events) {
      if (!isRecord(event)) {
        continue;
      }

      const title = asString(event.title) ?? 'Open event';
      const category = Array.isArray(event.categories)
        ? event.categories.find(isRecord)
        : null;
      const hazardClass = canonicalHazardClass(
        asString(category?.id) ?? asString(category?.title) ?? '',
      );
      const point = lastPoint(event.geometry);
      const source = Array.isArray(event.sources)
        ? event.sources.find(isRecord)
        : null;
      reports.push(
        ...assignReports({
          provider: 'eonet',
          title,
          hazardClass,
          point,
          url: source ? asString(source.url) : null,
          origin,
          destination,
        }),
      );
    }

    return { reports, error: null };
  } catch (error) {
    return { reports: [], error: errorMessage(error, 'EONET request failed') };
  }
}

export async function fetchUsgs(
  origin: LocatedPlace,
  destination: LocatedPlace,
): Promise<{ reports: DisasterReport[]; error: string | null }> {
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const settled = await Promise.all(
    [origin, destination].map(async (place) => {
      try {
        const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
        url.searchParams.set('format', 'geojson');
        url.searchParams.set('minmagnitude', '4.5');
        url.searchParams.set('starttime', start);
        url.searchParams.set('latitude', String(place.lat));
        url.searchParams.set('longitude', String(place.lon));
        url.searchParams.set('maxradiuskm', String(DISASTER_RADIUS_KM));
        url.searchParams.set('limit', '20');
        url.searchParams.set('orderby', 'time');
        const body = await requestJson(url.toString());
        return {
          reports: geoJsonReports('usgs', body, origin, destination),
          error: null,
        };
      } catch (error) {
        return {
          reports: [] as DisasterReport[],
          error: errorMessage(error, 'USGS request failed'),
        };
      }
    }),
  );
  const reports = settled.flatMap((item) => item.reports);
  const errors = settled.flatMap((item) => (item.error ? [item.error] : []));

  if (reports.length === 0 && errors.length === 2) {
    return { reports: [], error: errors[0] ?? 'USGS request failed' };
  }

  return { reports: dedupeReports(reports), error: null };
}

export async function fetchReliefWebDisasters(
  origin: LocatedPlace,
  destination: LocatedPlace,
): Promise<{ reports: DisasterReport[]; error: string | null }> {
  try {
    const url = new URL('https://api.reliefweb.int/v2/disasters');
    url.searchParams.set('appname', reliefWebAppName());
    url.searchParams.set('limit', '40');
    url.searchParams.set('profile', 'full');
    url.searchParams.set('preset', 'latest');
    url.searchParams.set('filter[field]', 'status');
    url.searchParams.set('filter[value]', 'current');
    const body = await requestJson(url.toString());
    if (!isRecord(body) || !Array.isArray(body.data)) {
      return { reports: [], error: null };
    }

    const reports: DisasterReport[] = [];
    for (const row of body.data) {
      if (!isRecord(row) || !isRecord(row.fields)) {
        continue;
      }

      const status = asString(row.fields.status);
      if (status && status.toLowerCase() !== 'current') {
        continue;
      }

      const title = asString(row.fields.name) ?? 'ReliefWeb disaster';
      const type = Array.isArray(row.fields.type)
        ? row.fields.type.find(isRecord)
        : null;
      const country = Array.isArray(row.fields.country)
        ? row.fields.country.find(isRecord)
        : null;
      const location =
        country && isRecord(country.location) ? country.location : null;
      const lat = asNumber(location?.lat);
      const lon = asNumber(location?.lon);
      reports.push(
        ...assignReports({
          provider: 'reliefweb',
          title,
          hazardClass: canonicalHazardClass(
            asString(type?.name) ?? asString(type?.code) ?? '',
          ),
          point: lat !== null && lon !== null ? { lat, lon } : null,
          url: asString(row.fields.url) ?? asString(row.href),
          origin,
          destination,
        }),
      );
    }

    return { reports, error: null };
  } catch (error) {
    return {
      reports: [],
      error: errorMessage(error, 'ReliefWeb disasters request failed'),
    };
  }
}

function geoJsonReports(
  provider: DisasterProvider,
  body: unknown,
  origin: LocatedPlace,
  destination: LocatedPlace,
): DisasterReport[] {
  const features = featureList(body);
  const reports: DisasterReport[] = [];
  for (const feature of features) {
    if (!isCurrent(feature.properties)) {
      continue;
    }

    const title =
      asString(feature.properties?.name) ??
      asString(feature.properties?.title) ??
      asString(feature.properties?.eventname) ??
      asString(feature.properties?.htmldescription) ??
      'Disaster';
    const hazardClass = canonicalHazardClass(
      asString(feature.properties?.eventtype) ??
        asString(feature.properties?.hazard) ??
        (provider === 'usgs' ? 'earthquake' : ''),
    );
    const urlRecord =
      feature.properties && isRecord(feature.properties.url)
        ? feature.properties.url
        : null;
    reports.push(
      ...assignReports({
        provider,
        title: title
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
        hazardClass,
        point: feature.point,
        properties: feature.properties,
        url:
          asString(feature.properties?.url) ??
          (urlRecord ? asString(urlRecord.report) : null),
        origin,
        destination,
      }),
    );
  }

  return reports;
}

function assignReports(input: {
  provider: DisasterProvider;
  title: string;
  hazardClass: string;
  point: GeoPoint | null;
  properties?: Record<string, unknown> | null;
  url: string | null;
  origin: LocatedPlace;
  destination: LocatedPlace;
}): DisasterReport[] {
  if (input.hazardClass === 'other') {
    return [];
  }

  const countries = affectedCountryNames(input.properties ?? null);
  const wide =
    isCentroidEvent(input.properties ?? null) || countries.length >= 4;
  if (wide) {
    return countriesOnLane(
      countries,
      input.origin.country,
      input.destination.country,
    ).map((end) => ({
      provider: input.provider,
      place: end.place,
      hazardClass: input.hazardClass,
      headline: `${hazardLead(input.title)} in ${end.country}`,
      url: input.url,
    }));
  }

  const ends = assignEnds(
    input.point,
    input.title,
    input.origin,
    input.destination,
  );
  return ends.map((place) => ({
    provider: input.provider,
    place,
    hazardClass: input.hazardClass,
    headline: input.title,
    url: input.url,
  }));
}

function assignEnds(
  point: GeoPoint | null,
  title: string,
  origin: LocatedPlace,
  destination: LocatedPlace,
): LaneEnd[] {
  if (point) {
    const near: LaneEnd[] = [];
    if (haversineKm(point, origin) <= DISASTER_RADIUS_KM) {
      near.push('origin');
    }
    if (haversineKm(point, destination) <= DISASTER_RADIUS_KM) {
      near.push('destination');
    }
    if (near.length > 0) {
      return near;
    }
  }

  const named: LaneEnd[] = [];
  if (mentionsPlace(title, origin.name)) {
    named.push('origin');
  }
  if (mentionsPlace(title, destination.name)) {
    named.push('destination');
  }
  return named;
}

type Feature = {
  properties: Record<string, unknown> | null;
  point: GeoPoint | null;
};

function featureList(body: unknown): Feature[] {
  const rows =
    isRecord(body) && Array.isArray(body.features)
      ? body.features
      : Array.isArray(body)
        ? body
        : [];
  const features: Feature[] = [];
  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const properties = isRecord(row.properties) ? row.properties : row;
    const geometry = isRecord(row.geometry) ? row.geometry : null;
    const coordinates =
      geometry && Array.isArray(geometry.coordinates)
        ? geometry.coordinates
        : null;
    const lon = coordinates
      ? asNumber(coordinates[0])
      : asNumber(properties.lon);
    const lat = coordinates
      ? asNumber(coordinates[1])
      : asNumber(properties.lat);
    features.push({
      properties,
      point: lat !== null && lon !== null ? { lat, lon } : null,
    });
  }

  return features;
}

function isCurrent(properties: Record<string, unknown> | null): boolean {
  if (!properties) {
    return true;
  }

  const current = properties.iscurrent ?? properties.isCurrent;
  if (current === true || current === 'true' || current === 'True') {
    return true;
  }

  const from = Date.parse(
    String(properties.fromdate ?? properties.time ?? properties.date ?? ''),
  );
  if (!Number.isFinite(from)) {
    return true;
  }

  return Date.now() - from <= CURRENT_MS;
}

function lastPoint(geometry: unknown): GeoPoint | null {
  if (!Array.isArray(geometry) || geometry.length === 0) {
    return null;
  }

  const last = geometry[geometry.length - 1];
  if (!isRecord(last) || !Array.isArray(last.coordinates)) {
    return null;
  }

  const lon = asNumber(last.coordinates[0]);
  const lat = asNumber(last.coordinates[1]);
  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
}

function dedupeReports(reports: DisasterReport[]): DisasterReport[] {
  const seen = new Set<string>();
  const unique: DisasterReport[] = [];
  for (const report of reports) {
    const key = `${report.provider}:${report.place}:${report.hazardClass}:${report.headline}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(report);
  }

  return unique;
}
