import type { LocatedPlace } from './geocode.js';
import { locatePlace } from './geocode.js';

export type CachedPlace = {
  lat: number;
  lon: number;
  country: string | null;
};

export type PlaceCacheStore = {
  findOne(query: string): Promise<CachedPlace | null>;
  save(row: CachedPlace & { query: string }): Promise<void>;
};

export async function locateWithCache(
  raw: string,
  cache: PlaceCacheStore,
  locate: (query: string) => Promise<LocatedPlace> = locatePlace,
): Promise<LocatedPlace | null> {
  const query = raw.trim();
  if (query.length === 0) {
    return null;
  }

  const cached = await cache.findOne(query);
  if (cached) {
    return {
      name: query,
      lat: cached.lat,
      lon: cached.lon,
      country: cached.country,
    };
  }

  const located = await locate(query);
  try {
    await cache.save({
      query,
      lat: located.lat,
      lon: located.lon,
      country: located.country,
    });
  } catch {
    // Another scan can store the same place first.
  }

  return located;
}
