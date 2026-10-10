import type { ShippingMode } from '@supplyeagle/types';

export type GeoPoint = {
  lat: number;
  lon: number;
};

export const PLACE_AGREEMENT_KM = 50;

const EARTH_RADIUS_KM = 6371;
const AIR_SPEED_KMH = 800;
const AIR_HANDLING_DAYS = 1;
const SEA_SPEED_KMH = 20 * 1.852;
const SEA_PORT_DAYS = 2;

export function haversineKm(left: GeoPoint, right: GeoPoint): number {
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const dLat = toRadians(right.lat - left.lat);
  const dLon = toRadians(right.lon - left.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function agreePlaces(left: GeoPoint | null, right: GeoPoint | null): GeoPoint | null {
  if (!isPoint(left) || !isPoint(right)) {
    return null;
  }

  if (haversineKm(left, right) > PLACE_AGREEMENT_KM) {
    return null;
  }

  return {
    lat: (left.lat + right.lat) / 2,
    lon: (left.lon + right.lon) / 2,
  };
}

export function transitDays(mode: ShippingMode, distanceKm: number): number {
  const movingDays = moving(mode, distanceKm);
  return Math.max(1, Math.round(movingDays));
}

function moving(mode: ShippingMode, distanceKm: number): number {
  switch (mode) {
    case 'air':
      return distanceKm / AIR_SPEED_KMH / 24 + AIR_HANDLING_DAYS;
    case 'sea':
      return distanceKm / SEA_SPEED_KMH / 24 + SEA_PORT_DAYS;
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}

function isPoint(point: GeoPoint | null): point is GeoPoint {
  return point !== null && Number.isFinite(point.lat) && Number.isFinite(point.lon);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
