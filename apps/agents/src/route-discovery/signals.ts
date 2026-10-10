import type { AnalysisConfidence } from '@supplyeagle/types';

export type LaneEnd = 'origin' | 'destination';

export type NewsProvider = 'gdelt' | 'google_news' | 'reliefweb';

export type NewsHazard = 'closure' | 'strike' | 'congestion' | 'storm' | 'conflict';

export type NewsReport = {
  provider: NewsProvider;
  place: LaneEnd;
  hazard: NewsHazard;
  domains: string[];
  headline: string;
  url?: string | null;
};

export type ConfirmedNews = {
  place: LaneEnd;
  hazard: NewsHazard;
  headline: string;
  providers: NewsProvider[];
  domains: string[];
};

export type WeatherProvider = 'open_meteo' | 'met_norway';

export type WeatherCode = 'wind' | 'wave' | 'visibility';

export type WeatherReading = {
  provider: WeatherProvider;
  place: LaneEnd;
  windKmh: number | null;
  waveHeightM: number | null;
  visibilityM: number | null;
};

export type ConfirmedWeather = {
  place: LaneEnd;
  code: WeatherCode;
  extreme: boolean;
  why: string;
};

export type DisasterProvider = 'gdacs' | 'eonet' | 'usgs' | 'reliefweb';

export type DisasterReport = {
  provider: DisasterProvider;
  place: LaneEnd;
  hazardClass: string;
  headline: string;
  url?: string | null;
};

export type ConfirmedDisaster = {
  place: LaneEnd;
  hazardClass: string;
  headline: string;
  providers: DisasterProvider[];
};

export type SupplierFlagInput = {
  name: string;
  sanctionsHit: boolean | null;
  confidence: AnalysisConfidence | null;
};

export type SupplierPropagation = {
  name: string;
  level: 'watch' | 'elevated';
  why: string;
};

export const STORM_WIND_KMH = 75;
export const EXTREME_WIND_KMH = 103;
export const HIGH_WAVE_M = 4;
export const EXTREME_WAVE_M = 6;
export const POOR_VISIBILITY_M = 1000;
export const EXTREME_VISIBILITY_M = 200;

const NEWS_PROVIDERS = 2;
const NEWS_DOMAINS = 3;
const DISASTER_PROVIDERS = 2;

export function confirmedNews(reports: NewsReport[]): ConfirmedNews[] {
  const groups = new Map<string, NewsReport[]>();
  for (const report of reports) {
    const key = `${report.place}:${report.hazard}`;
    const group = groups.get(key) ?? [];
    group.push(report);
    groups.set(key, group);
  }

  const confirmed: ConfirmedNews[] = [];
  for (const group of groups.values()) {
    const providers = unique(group.map((report) => report.provider));
    const domains = unique(
      group.flatMap((report) => report.domains.map((domain) => normalizeDomain(domain))),
    ).filter((domain) => domain.length > 0);
    const headline = group.find((report) => report.headline.trim().length > 0)?.headline ?? '';
    const sample = group[0];
    if (!sample || providers.length < NEWS_PROVIDERS || domains.length < NEWS_DOMAINS) {
      continue;
    }

    confirmed.push({
      place: sample.place,
      hazard: sample.hazard,
      headline,
      providers,
      domains,
    });
  }

  return confirmed;
}

export function confirmWeather(
  readings: WeatherReading[],
  placeNames: Record<LaneEnd, string>,
): ConfirmedWeather[] {
  const merged = mergeReadings(readings);
  const confirmed: ConfirmedWeather[] = [];
  const places: LaneEnd[] = ['origin', 'destination'];
  const codes: WeatherCode[] = ['wind', 'wave', 'visibility'];

  for (const place of places) {
    const openMeteo = merged.find(
      (reading) => reading.provider === 'open_meteo' && reading.place === place,
    );
    const metNorway = merged.find(
      (reading) => reading.provider === 'met_norway' && reading.place === place,
    );
    if (!openMeteo || !metNorway) {
      continue;
    }

    for (const code of codes) {
      const left = crossed(openMeteo, code);
      const right = crossed(metNorway, code);
      if (!left.crossed || !right.crossed) {
        continue;
      }

      const extreme = left.extreme && right.extreme;
      confirmed.push({
        place,
        code,
        extreme,
        why: weatherWhy(code, extreme, placeNames[place]),
      });
    }
  }

  return confirmed;
}

export function confirmDisasters(reports: DisasterReport[]): ConfirmedDisaster[] {
  const groups = new Map<string, DisasterReport[]>();
  for (const report of reports) {
    const hazardClass = canonicalHazardClass(report.hazardClass);
    if (hazardClass === 'other') {
      continue;
    }

    const key = `${report.place}:${hazardClass}`;
    const group = groups.get(key) ?? [];
    group.push({ ...report, hazardClass });
    groups.set(key, group);
  }

  const confirmed: ConfirmedDisaster[] = [];
  for (const group of groups.values()) {
    const providers = unique(group.map((report) => report.provider));
    const sample = group[0];
    if (!sample || providers.length < DISASTER_PROVIDERS) {
      continue;
    }

    confirmed.push({
      place: sample.place,
      hazardClass: sample.hazardClass,
      headline: sample.headline.trim() || `${sample.hazardClass} at ${sample.place}`,
      providers,
    });
  }

  return confirmed;
}

export function propagateSuppliers(inputs: SupplierFlagInput[]): SupplierPropagation | null {
  let best: SupplierPropagation | null = null;
  for (const input of inputs) {
    const level = supplierLevel(input);
    if (!level) {
      continue;
    }

    if (!best || (level === 'elevated' && best.level === 'watch')) {
      best = {
        name: input.name,
        level,
        why: `propagated from → ${input.name}`,
      };
    }
  }

  return best;
}

export function canonicalHazardClass(value: string): string {
  const text = value.trim().toLowerCase();
  switch (text) {
    case 'eq':
    case 'earthquake':
    case 'earthquakes':
      return 'earthquake';
    case 'tc':
    case 'cyclone':
    case 'tropical cyclone':
      return 'cyclone';
    case 'fl':
    case 'flood':
    case 'floods':
      return 'flood';
    case 'vo':
    case 'volcano':
    case 'volcanoes':
      return 'volcano';
    case 'wf':
    case 'wildfire':
    case 'wildfires':
      return 'wildfire';
    case 'dr':
    case 'drought':
      return 'drought';
    case 'landslide':
    case 'landslides':
      return 'landslide';
    case 'tsunami':
    case 'tsunamis':
      return 'tsunami';
    case 'storm':
    case 'storms':
    case 'severestorms':
      return 'storm';
    default:
      break;
  }

  if (text.includes('earthquake')) {
    return 'earthquake';
  }
  if (text.includes('cyclone') || text.includes('hurricane') || text.includes('typhoon')) {
    return 'cyclone';
  }
  if (text.includes('flood')) {
    return 'flood';
  }
  if (text.includes('volcano')) {
    return 'volcano';
  }
  if (text.includes('wildfire') || text.includes('forest fire')) {
    return 'wildfire';
  }
  if (text.includes('drought')) {
    return 'drought';
  }
  if (text.includes('landslide')) {
    return 'landslide';
  }
  if (text.includes('tsunami')) {
    return 'tsunami';
  }
  if (text.includes('storm')) {
    return 'storm';
  }
  return 'other';
}

export function normalizeDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  const host = hostOf(trimmed);
  const bare = host.replace(/^www\./, '');
  if (bare === 'news.google.com' || bare.endsWith('.news.google.com') || bare === 'google.com') {
    return '';
  }

  return bare;
}

function hostOf(value: string): string {
  if (value.includes('://')) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return value;
    }
  }

  return value.split('/')[0] ?? value;
}

function supplierLevel(input: SupplierFlagInput): 'watch' | 'elevated' | null {
  if (input.sanctionsHit === true) {
    return 'elevated';
  }

  switch (input.confidence) {
    case 'partial':
    case 'conflicting':
    case 'unverified':
      return 'watch';
    case 'verified':
    case null:
      return null;
    default: {
      const unexpected: never = input.confidence;
      return unexpected;
    }
  }
}

function crossed(
  reading: WeatherReading,
  code: WeatherCode,
): { crossed: boolean; extreme: boolean } {
  switch (code) {
    case 'wind':
      return threshold(reading.windKmh, STORM_WIND_KMH, EXTREME_WIND_KMH);
    case 'wave':
      return threshold(reading.waveHeightM, HIGH_WAVE_M, EXTREME_WAVE_M);
    case 'visibility':
      return lowerThreshold(reading.visibilityM, POOR_VISIBILITY_M, EXTREME_VISIBILITY_M);
    default: {
      const unexpected: never = code;
      return unexpected;
    }
  }
}

function threshold(
  value: number | null,
  severe: number,
  extreme: number,
): { crossed: boolean; extreme: boolean } {
  if (value === null || !Number.isFinite(value) || value < severe) {
    return { crossed: false, extreme: false };
  }

  return { crossed: true, extreme: value >= extreme };
}

function lowerThreshold(
  value: number | null,
  severe: number,
  extreme: number,
): { crossed: boolean; extreme: boolean } {
  if (value === null || !Number.isFinite(value) || value > severe) {
    return { crossed: false, extreme: false };
  }

  return { crossed: true, extreme: value <= extreme };
}

function weatherWhy(code: WeatherCode, extreme: boolean, placeName: string): string {
  const level = extreme ? 'Extreme' : 'Severe';
  switch (code) {
    case 'wind':
      return `${level} wind at ${placeName}`;
    case 'wave':
      return `${level} waves at ${placeName}`;
    case 'visibility':
      return `${level} low visibility at ${placeName}`;
    default: {
      const unexpected: never = code;
      return unexpected;
    }
  }
}

function mergeReadings(readings: WeatherReading[]): WeatherReading[] {
  const merged = new Map<string, WeatherReading>();
  for (const reading of readings) {
    const key = `${reading.provider}:${reading.place}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...reading });
      continue;
    }

    existing.windKmh = maxNumber(existing.windKmh, reading.windKmh);
    existing.waveHeightM = maxNumber(existing.waveHeightM, reading.waveHeightM);
    existing.visibilityM = minNumber(existing.visibilityM, reading.visibilityM);
  }

  return [...merged.values()];
}

function maxNumber(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return Math.max(left, right);
}

function minNumber(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return Math.min(left, right);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
