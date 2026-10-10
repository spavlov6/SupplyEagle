import { asString, isRecord } from './http.js';
import type { LaneEnd } from './signals.js';

export function affectedCountryNames(
  properties: Record<string, unknown> | null,
): string[] {
  if (!properties) {
    return [];
  }

  if (Array.isArray(properties.affectedcountries)) {
    const names = properties.affectedcountries.flatMap((row) => {
      if (!isRecord(row)) {
        return [];
      }
      const name = asString(row.countryname);
      return name ? [name] : [];
    });
    if (names.length > 0) {
      return names;
    }
  }

  const country = asString(properties.country);
  if (!country) {
    return [];
  }

  return country
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function isCentroidEvent(
  properties: Record<string, unknown> | null,
): boolean {
  if (!properties) {
    return false;
  }

  return (
    asString(properties.Class) === 'Point_Centroid' ||
    asString(properties.polygonlabel) === 'Centroid'
  );
}

export function countriesOnLane(
  names: string[],
  originCountry: string | null,
  destinationCountry: string | null,
): Array<{ place: LaneEnd; country: string }> {
  const ends: Array<{ place: LaneEnd; country: string | null }> = [
    { place: 'origin', country: originCountry },
    { place: 'destination', country: destinationCountry },
  ];

  return ends.flatMap((end) => {
    if (!end.country) {
      return [];
    }
    const match = names.find((name) => sameCountry(name, end.country ?? ''));
    return match ? [{ place: end.place, country: match }] : [];
  });
}

export function hazardLead(title: string): string {
  const match = title.match(/^(.+?)\s+in\s+/i);
  const lead = match?.[1]?.replace(/\s+/g, ' ').trim();
  return lead && lead.length > 0 ? lead : title;
}

function sameCountry(left: string, right: string): boolean {
  return normalizeCountry(left) === normalizeCountry(right);
}

function normalizeCountry(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
