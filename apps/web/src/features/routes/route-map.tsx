import type { RiskState, ShippingMode } from '@supplyeagle/types';
import {
  circleMarker,
  control,
  map as createMap,
  polyline,
  tileLayer,
  type Map as LeafletMap,
} from 'leaflet';
import { useEffect, useRef } from 'react';
import { laneFrame, laneLine, type FramePoint } from './lane-frame';
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

    const line = laneLine(from, to);
    polyline(line, {
      color,
      weight: 3,
      opacity: 0.95,
      className: 'route-lane',
    }).addTo(map);
    const originIsNorth = from.lat >= to.lat;
    mark(
      map,
      line[0] ?? [from.lat, from.lon],
      from.name,
      originIsNorth ? 'top' : 'bottom',
      color,
    );
    mark(
      map,
      line[line.length - 1] ?? [to.lat, to.lon],
      to.name,
      originIsNorth ? 'bottom' : 'top',
      color,
    );

    let framedWidth = 0;
    let framedHeight = 0;
    const frame = () => {
      map.invalidateSize({ animate: false, pan: false });
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (
        width < 2 ||
        height < 2 ||
        (width === framedWidth && height === framedHeight)
      ) {
        return;
      }
      framedWidth = width;
      framedHeight = height;
      const view = laneFrame(from, to, { width, height });
      map.setMinZoom(view.minZoom);
      map.setView(view.center, view.zoom, { animate: false });
    };

    const observer = new ResizeObserver(frame);
    observer.observe(element);
    frame();

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [from, to, color]);

  return <div ref={node} className="route-map" />;
}

function mark(
  map: LeafletMap,
  point: FramePoint,
  name: string,
  direction: 'top' | 'bottom',
  color: string,
): void {
  circleMarker(point, {
    radius: 6,
    color,
    weight: 2,
    fillColor: 'white',
    fillOpacity: 1,
  })
    .bindTooltip(name, {
      permanent: true,
      direction,
      offset: [0, direction === 'top' ? -8 : 8],
      className: 'route-map-label',
      opacity: 1,
    })
    .addTo(map);
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
