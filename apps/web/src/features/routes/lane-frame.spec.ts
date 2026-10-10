import { describe, expect, it } from 'vitest';
import { laneFrame, type FramePoint } from './lane-frame';

const beijing = { lat: 39.9, lon: 116.4 };
const newYork = { lat: 40.71, lon: -74.01 };
const london = { lat: 51.51, lon: -0.13 };
const paris = { lat: 48.86, lon: 2.35 };
const tokyo = { lat: 35.68, lon: 139.69 };
const sanFrancisco = { lat: 37.77, lon: -122.42 };
const shanghai = { lat: 31.23, lon: 121.47 };
const rotterdam = { lat: 51.92, lon: 4.48 };

function worldWidth(zoom: number): number {
  return 256 * 2 ** zoom;
}

function viewPoint(
  point: FramePoint,
  center: FramePoint,
  zoom: number,
  size: { width: number; height: number },
): { x: number; y: number } {
  const world = worldWidth(zoom);
  const project = (lat: number, lng: number) => ({
    x: (lng / 360 + 0.5) * world,
    y: mercatorT(lat) * world,
  });
  const origin = project(center[0], center[1]);
  const placed = project(point[0], point[1]);
  return {
    x: placed.x - (origin.x - size.width / 2),
    y: placed.y - (origin.y - size.height / 2),
  };
}

function mercatorT(lat: number): number {
  const max = 85.0511287798;
  const clamped = Math.max(-max, Math.min(max, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function expectInside(
  point: FramePoint,
  frame: ReturnType<typeof laneFrame>,
  size: { width: number; height: number },
): void {
  const placed = viewPoint(point, frame.center, frame.zoom, size);
  expect(placed.x).toBeGreaterThan(8);
  expect(placed.x).toBeLessThan(size.width - 8);
  expect(placed.y).toBeGreaterThan(8);
  expect(placed.y).toBeLessThan(size.height - 8);
}

describe('laneFrame', () => {
  it('shows a polar lane once on a wide map', () => {
    const size = { width: 960, height: 540 };
    const frame = laneFrame(beijing, newYork, size);

    expect(worldWidth(frame.zoom)).toBeGreaterThanOrEqual(size.width);
    expect(worldWidth(frame.minZoom)).toBeGreaterThanOrEqual(size.width);
    expect(frame.zoom).toBeLessThanOrEqual(8);
    expect(frame.zoom).toBeGreaterThanOrEqual(frame.minZoom);
    expectContinuous(frame.line);
    expectInside(frame.line[0] ?? [0, 0], frame, size);
    expectInside(frame.line[frame.line.length - 1] ?? [0, 0], frame, size);
  });

  it('keeps a pacific lane on one continuous track', () => {
    const size = { width: 1120, height: 520 };
    const frame = laneFrame(tokyo, sanFrancisco, size);

    expect(worldWidth(frame.minZoom)).toBeGreaterThanOrEqual(size.width);
    expectContinuous(frame.line);
    expectInside(frame.line[0] ?? [0, 0], frame, size);
    expectInside(frame.line[frame.line.length - 1] ?? [0, 0], frame, size);
  });

  it('zooms a short lane in without exceeding the overview cap', () => {
    const frame = laneFrame(london, paris, { width: 960, height: 480 });

    expect(frame.zoom).toBeGreaterThan(4);
    expect(frame.zoom).toBeLessThanOrEqual(8);
    expectContinuous(frame.line);
  });

  it('frames an overland lane inside a phone-sized map', () => {
    const size = { width: 340, height: 240 };
    const frame = laneFrame(shanghai, rotterdam, size);

    expect(worldWidth(frame.zoom)).toBeGreaterThanOrEqual(size.width);
    expectInside(frame.line[0] ?? [0, 0], frame, size);
    expectInside(frame.line[frame.line.length - 1] ?? [0, 0], frame, size);
  });

  it('does not zoom out below zero on a very narrow map', () => {
    const frame = laneFrame(beijing, newYork, { width: 180, height: 220 });

    expect(frame.minZoom).toBeGreaterThanOrEqual(0);
    expect(frame.zoom).toBeGreaterThanOrEqual(0);
  });
});

function expectContinuous(line: FramePoint[]): void {
  expect(line.length).toBeGreaterThan(2);
  for (let index = 1; index < line.length; index += 1) {
    const previous = line[index - 1]?.[1] ?? 0;
    const longitude = line[index]?.[1] ?? 0;
    expect(Math.abs(longitude - previous)).toBeLessThanOrEqual(180);
  }
}
