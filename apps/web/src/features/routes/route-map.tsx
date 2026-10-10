import type { RiskState, ShippingMode } from '@supplyeagle/types';
import {
  circleMarker,
  control,
  latLngBounds,
  map as createMap,
  polyline,
  tileLayer,
  type LatLngExpression,
  type Map as LeafletMap,
} from 'leaflet';
import { useEffect, useRef } from 'react';
import { type LanePlace, useLanePlaces } from './lane-places';
import 'leaflet/dist/leaflet.css';

export function RouteMap({
  origin,
  destination,
  mode,
  risk,
}: {
  origin: string;
  destination: string;
  mode: ShippingMode;
  risk: RiskState | null;
}) {
  const places = useLanePlaces(origin, destination);

  if (places.isPending) {
    return (
      <section className="card route-map-card" aria-label="Route map">
        <div className="route-map-loading">
          <span className="spinner spinner-lg" aria-hidden="true" />
          <p>
            Placing {origin} and {destination}
          </p>
        </div>
      </section>
    );
  }

  if (places.isError || !places.data) {
    return (
      <section className="card route-map-card" aria-label="Route map">
        <div className="route-map-loading">
          <p>This lane could not be placed on the map.</p>
        </div>
      </section>
    );
  }

  const [from, to] = places.data;

  return (
    <section className="card route-map-card" aria-label="Route map">
      <div className="route-map-frame">
        <LaneMap from={from} to={to} color={lineColor(risk)} />
        <p className="route-map-legend">
          <span>{modeLabel(mode)}</span>
          <span>{formatKm(distanceKm(from, to))}</span>
        </p>
      </div>
    </section>
  );
}

function LaneMap({
  from,
  to,
  color,
}: {
  from: LanePlace;
  to: LanePlace;
  color: string;
}) {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = node.current;
    if (!element) {
      return;
    }

    const map = createMap(element, {
      scrollWheelZoom: false,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.1,
    });
    control.zoom({ position: 'topright' }).addTo(map);
    const attribution = 'Tiles &copy; Esri';
    tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { attribution, maxZoom: 16 },
    ).addTo(map);
    tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16 },
    ).addTo(map);

    const line = geodesic(from, to);
    for (const segment of splitAtAntimeridian(line)) {
      polyline(segment, {
        color,
        weight: 3,
        opacity: 0.95,
        className: 'route-lane',
      }).addTo(map);
    }
    mark(map, from, 'top', color);
    mark(map, to, 'bottom', color);
    frameLane(map, from, to);
    requestAnimationFrame(() => {
      map.invalidateSize();
      frameLane(map, from, to);
    });

    return () => {
      map.remove();
    };
  }, [from, to, color]);

  return <div ref={node} className="route-map" />;
}

function frameLane(map: LeafletMap, from: LanePlace, to: LanePlace): void {
  const line = geodesic(from, to).flatMap((point) => {
    if (!Array.isArray(point)) {
      return [];
    }

    const latitude = point[0];
    const longitude = point[1];
    if (latitude === undefined || longitude === undefined) {
      return [];
    }

    return [
      [latitude, unwrapLongitude(from.lon, longitude)] as [number, number],
    ];
  });
  map.fitBounds(latLngBounds(line), {
    padding: [56, 64],
    maxZoom: 8,
    animate: false,
  });
}

function unwrapLongitude(originLon: number, destinationLon: number): number {
  let longitude = destinationLon;
  while (longitude - originLon > 180) {
    longitude -= 360;
  }
  while (originLon - longitude > 180) {
    longitude += 360;
  }
  return longitude;
}

function mark(
  map: LeafletMap,
  point: LanePlace,
  direction: 'top' | 'bottom',
  color: string,
): void {
  circleMarker([point.lat, point.lon], {
    radius: 6,
    color,
    weight: 2,
    fillColor: 'white',
    fillOpacity: 1,
  })
    .bindTooltip(point.name, {
      permanent: true,
      direction,
      offset: [0, direction === 'top' ? -8 : 8],
      className: 'route-map-label',
      opacity: 1,
    })
    .addTo(map);
}

function geodesic(start: LanePlace, end: LanePlace): LatLngExpression[] {
  const startLat = toRadians(start.lat);
  const startLon = toRadians(start.lon);
  const endLat = toRadians(end.lat);
  const endLon = toRadians(end.lon);
  const angular =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin((endLat - startLat) / 2) ** 2 +
            Math.cos(startLat) *
              Math.cos(endLat) *
              Math.sin((endLon - startLon) / 2) ** 2,
        ),
      ),
    );
  if (!Number.isFinite(angular) || Math.abs(Math.sin(angular)) < 1e-8) {
    return [
      [start.lat, start.lon],
      [end.lat, end.lon],
    ];
  }

  const steps = 72;
  const points: LatLngExpression[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const fraction = step / steps;
    const startWeight = Math.sin((1 - fraction) * angular) / Math.sin(angular);
    const endWeight = Math.sin(fraction * angular) / Math.sin(angular);
    const x =
      startWeight * Math.cos(startLat) * Math.cos(startLon) +
      endWeight * Math.cos(endLat) * Math.cos(endLon);
    const y =
      startWeight * Math.cos(startLat) * Math.sin(startLon) +
      endWeight * Math.cos(endLat) * Math.sin(endLon);
    const z = startWeight * Math.sin(startLat) + endWeight * Math.sin(endLat);
    const latitude = Math.atan2(z, Math.sqrt(x * x + y * y));
    const longitude = Math.atan2(y, x);
    points.push([toDegrees(latitude), toDegrees(longitude)]);
  }

  return points;
}

function splitAtAntimeridian(points: LatLngExpression[]): LatLngExpression[][] {
  const segments: LatLngExpression[][] = [];
  let current: LatLngExpression[] = [];

  for (const point of points) {
    const previous = current[current.length - 1];
    const longitude = pointLongitude(point);
    if (
      previous &&
      longitude !== null &&
      Math.abs(longitude - (pointLongitude(previous) ?? longitude)) > 180
    ) {
      segments.push(current);
      current = [point];
      continue;
    }

    current.push(point);
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function pointLongitude(point: LatLngExpression): number | null {
  if (Array.isArray(point)) {
    return point[1];
  }

  return null;
}

function distanceKm(start: LanePlace, end: LanePlace): number {
  const earthKm = 6371;
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const dLat = toRadians(end.lat - start.lat);
  const dLon = toRadians(end.lon - start.lon);
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function formatKm(kilometers: number): string {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(kilometers)} km`;
}

function lineColor(risk: RiskState | null): string {
  switch (risk) {
    case 'critical':
      return 'var(--destructive)';
    case 'elevated':
    case 'watch':
      return 'var(--warning)';
    case 'stable':
    case null:
      return 'var(--primary)';
    default: {
      const unexpected: never = risk;
      return unexpected;
    }
  }
}

function modeLabel(mode: ShippingMode): string {
  switch (mode) {
    case 'air':
      return 'Air';
    case 'sea':
      return 'Sea cargo';
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
