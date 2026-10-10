export type FramePoint = [number, number];

export type LaneFrame = {
  center: FramePoint;
  zoom: number;
  minZoom: number;
  line: FramePoint[];
};

const WORLD_TILE = 256;
const MAX_ZOOM = 8;
const ZOOM_SNAP = 0.1;
const PAD_X = 72;
const PAD_Y = 56;

export function laneLine(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): FramePoint[] {
  return unwrapPath(geodesic(from, to));
}

export function laneFrame(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  size: { width: number; height: number },
): LaneFrame {
  const line = laneLine(from, to);
  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const west = Math.min(...line.map((point) => point[1]));
  const east = Math.max(...line.map((point) => point[1]));
  const south = Math.min(...line.map((point) => point[0]));
  const north = Math.max(...line.map((point) => point[0]));

  const usableW = Math.max(width - PAD_X * 2, 32);
  const usableH = Math.max(height - PAD_Y * 2, 32);
  const boundsW = Math.max(((east - west) / 360) * WORLD_TILE, 1);
  const boundsH = Math.max(
    Math.abs(mercatorT(north) - mercatorT(south)) * WORLD_TILE,
    1,
  );
  const fitted = snap(
    Math.log2(Math.min(usableW / boundsW, usableH / boundsH)),
    'floor',
  );
  // One world must stay at least as wide as the map. Zooming out further
  // repeats the world and splits the lane across copies.
  const minZoom = Math.max(0, snap(Math.log2(width / WORLD_TILE), 'ceil'));
  const zoom = Math.min(Math.max(fitted, minZoom), Math.max(MAX_ZOOM, minZoom));
  const center = centerOf(line, zoom, usableW, usableH);

  return { center, zoom, minZoom, line };
}

function centerOf(
  line: FramePoint[],
  zoom: number,
  usableW: number,
  usableH: number,
): FramePoint {
  const full = box(line);
  const world = WORLD_TILE * 2 ** zoom;
  const fullW = ((full.east - full.west) / 360) * world;
  const fullH = Math.abs(mercatorT(full.north) - mercatorT(full.south)) * world;
  if (fullW <= usableW && fullH <= usableH) {
    return midpoint(full.south, full.north, full.west, full.east);
  }

  const start = line[0] ?? [0, 0];
  const end = line[line.length - 1] ?? start;
  const ends = box([start, end]);
  return midpoint(ends.south, ends.north, ends.west, ends.east);
}

function box(line: FramePoint[]): {
  south: number;
  north: number;
  west: number;
  east: number;
} {
  return {
    south: Math.min(...line.map((point) => point[0])),
    north: Math.max(...line.map((point) => point[0])),
    west: Math.min(...line.map((point) => point[1])),
    east: Math.max(...line.map((point) => point[1])),
  };
}

function midpoint(
  south: number,
  north: number,
  west: number,
  east: number,
): FramePoint {
  return [
    latFromMercatorT((mercatorT(south) + mercatorT(north)) / 2),
    (west + east) / 2,
  ];
}

function snap(value: number, mode: 'floor' | 'ceil'): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const scaled = value / ZOOM_SNAP;
  const stepped =
    mode === 'floor' ? Math.floor(scaled + 1e-8) : Math.ceil(scaled - 1e-8);
  return Math.round(stepped * ZOOM_SNAP * 1e6) / 1e6;
}

function mercatorT(lat: number): number {
  const max = 85.0511287798;
  const clamped = Math.max(-max, Math.min(max, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function latFromMercatorT(t: number): number {
  const ratio = Math.exp((0.5 - t) * 4 * Math.PI);
  const sin = (ratio - 1) / (ratio + 1);
  return (Math.asin(Math.max(-1, Math.min(1, sin))) * 180) / Math.PI;
}

function geodesic(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
): FramePoint[] {
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
  const points: FramePoint[] = [];
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

function unwrapPath(points: FramePoint[]): FramePoint[] {
  const unwrapped: FramePoint[] = [];
  let previous: number | null = null;
  for (const [latitude, longitude] of points) {
    let next = longitude;
    if (previous !== null) {
      while (next - previous > 180) {
        next -= 360;
      }
      while (previous - next > 180) {
        next += 360;
      }
    }
    unwrapped.push([latitude, next]);
    previous = next;
  }
  return unwrapped;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
