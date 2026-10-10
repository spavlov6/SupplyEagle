import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';

export type LanePlace = {
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  countryCode: string | null;
};

type GeocodeHit = {
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
};

type GeocodeResponse = {
  results?: GeocodeHit[];
};

export function useLanePlaces(origin: string, destination: string) {
  return useQuery({
    queryKey: queryKeys.places.lane(origin, destination),
    queryFn: () => Promise.all([locate(origin), locate(destination)]),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
}

async function locate(name: string): Promise<LanePlace> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not place ${name}`);
  }

  const body = (await response.json()) as GeocodeResponse;
  const hit = body.results?.[0];
  if (
    !hit ||
    !Number.isFinite(hit.latitude) ||
    !Number.isFinite(hit.longitude)
  ) {
    throw new Error(`Could not place ${name}`);
  }

  return {
    name,
    lat: hit.latitude,
    lon: hit.longitude,
    country: hit.country ?? null,
    countryCode: hit.country_code ?? null,
  };
}
