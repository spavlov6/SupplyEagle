import type { ShippingMode } from '@supplyeagle/types';
import type { RiskFactor, RiskImpact } from './score';

export const PIRACY_HIGH_POINTS = 28;
export const PIRACY_MEDIUM_POINTS = 22;
export const GEOPOLITICAL_HIGH_POINTS = 40;
export const GEOPOLITICAL_MEDIUM_POINTS = 25;
export const PASSAGE_POINTS = 22;
export const AIRSPACE_POINTS = 40;
export const SANCTIONED_END_POINTS = 70;
export const UNPLACED_POINTS = 8;

const SANCTIONED = new Set(['RU', 'BY', 'IR', 'SY', 'KP', 'CU']);
const CONFLICT = new Set([
  'UA',
  'SY',
  'YE',
  'IL',
  'SD',
  'MM',
  'LY',
  'SO',
  'IQ',
  'AF',
  'KP',
]);

const ASIA = ['east_asia', 'se_asia', 'oceania'] as const;
const EUROPE = ['north_europe', 'med'] as const;

type Basin =
  | 'east_asia'
  | 'se_asia'
  | 'south_asia'
  | 'gulf'
  | 'red_sea'
  | 'east_africa'
  | 'west_africa'
  | 'med'
  | 'north_europe'
  | 'black_sea'
  | 'us_east'
  | 'us_west'
  | 'caribbean'
  | 'south_america_east'
  | 'south_america_west'
  | 'oceania'
  | 'other';

export type LaneEnd = {
  country: string | null;
  countryCode: string | null;
  lat: number;
  lon: number;
};

type Exposure = {
  piracy: string[];
  geopolitical: string[];
  passages: string[];
};

const AIRSPACE = [
  { name: 'Russian airspace', south: 50, north: 72, west: 28, east: 140 },
  { name: 'Ukrainian airspace', south: 44, north: 53, west: 22, east: 40 },
  { name: 'Iranian airspace', south: 25, north: 40, west: 44, east: 64 },
  { name: 'Syrian airspace', south: 32, north: 37.5, west: 35, east: 42.5 },
  { name: 'Yemeni airspace', south: 12, north: 19, west: 42, east: 54 },
  {
    name: 'North Korean airspace',
    south: 37.5,
    north: 43.5,
    west: 124,
    east: 131,
  },
];

export function corridorFactors(input: {
  mode: ShippingMode;
  origin: LaneEnd | null;
  destination: LaneEnd | null;
}): RiskFactor[] {
  const origin = input.origin;
  const destination = input.destination;
  if (!origin || !destination) {
    return unplacedFactors(input.mode);
  }

  const originCode = origin.countryCode?.toUpperCase() ?? null;
  const destinationCode = destination.countryCode?.toUpperCase() ?? null;
  const originBasin = basin(origin.lat, origin.lon);
  const destinationBasin = basin(destination.lat, destination.lon);
  const sea =
    input.mode === 'sea' ? seaExposure(originBasin, destinationBasin) : null;
  const conflict = conflictEnds(origin, destination);

  const shared = [
    geopoliticalFactor(input.mode, sea, conflict),
    sanctionsFactor(origin, destination, originCode, destinationCode),
  ];
  switch (input.mode) {
    case 'air':
      return [...shared, airspaceFactor(origin, destination)];
    case 'sea':
      return [piracyFactor(sea), ...shared, passageFactor(sea?.passages ?? [])];
    default: {
      const unexpected: never = input.mode;
      return unexpected;
    }
  }
}

function unplacedFactors(mode: ShippingMode): RiskFactor[] {
  const shared = [
    warning(
      'Geopolitical',
      'Both ends need a position before corridor risk can be scored.',
    ),
    warning('Sanctions', 'The countries on this lane could not be identified.'),
  ];
  switch (mode) {
    case 'air':
      return [
        ...shared,
        clearFactor(
          'Airspace',
          'The lane could not be placed, so this is not scored.',
        ),
      ];
    case 'sea':
      return [
        clearFactor(
          'Piracy',
          'The lane could not be placed, so piracy is not scored.',
        ),
        ...shared,
        clearFactor(
          'Passage',
          'The lane could not be placed, so this is not scored.',
        ),
      ];
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}

function piracyFactor(sea: Exposure | null): RiskFactor {
  if (!sea) {
    return clearFactor(
      'Piracy',
      'No major piracy corridor on the usual sea lane.',
    );
  }

  if (sea.piracy.some((name) => /Aden|Guinea/.test(name))) {
    return {
      title: 'Piracy',
      evidence: `The usual sea lane crosses ${join(sea.piracy)}.`,
      points: PIRACY_HIGH_POINTS,
      impact: 'watch',
    };
  }

  if (sea.piracy.length > 0) {
    return {
      title: 'Piracy',
      evidence: `The usual sea lane crosses ${join(sea.piracy)}.`,
      points: PIRACY_MEDIUM_POINTS,
      impact: 'watch',
    };
  }

  return clearFactor(
    'Piracy',
    'No major piracy corridor on the usual sea lane.',
  );
}

function geopoliticalFactor(
  mode: ShippingMode,
  sea: Exposure | null,
  conflict: string[],
): RiskFactor {
  const corridors = sea?.geopolitical ?? [];
  const highCorridor = corridors.some((name) =>
    /Red Sea|Hormuz|Black Sea/.test(name),
  );
  if (highCorridor || conflict.length > 0) {
    const parts = [
      highCorridor ? `the usual ${mode} lane uses ${join(corridors)}` : null,
      conflict.length > 0 ? `${join(conflict)} is in active conflict` : null,
    ].filter((part): part is string => part !== null);
    return {
      title: 'Geopolitical',
      evidence: sentence(parts.join(', and ')),
      points: GEOPOLITICAL_HIGH_POINTS,
      impact: 'elevated',
    };
  }

  if (corridors.length > 0) {
    return {
      title: 'Geopolitical',
      evidence: `The usual sea lane touches ${join(corridors)}.`,
      points: GEOPOLITICAL_MEDIUM_POINTS,
      impact: 'watch',
    };
  }

  return clearFactor(
    'Geopolitical',
    mode === 'air'
      ? 'Neither end is in active conflict.'
      : 'No major geopolitical corridor on this lane.',
  );
}

function sanctionsFactor(
  origin: LaneEnd,
  destination: LaneEnd,
  originCode: string | null,
  destinationCode: string | null,
): RiskFactor {
  if (!originCode || !destinationCode) {
    return warning('Sanctions', 'One end of this lane has no country code.');
  }

  const hits = [
    SANCTIONED.has(originCode) ? placeName(origin, 'origin') : null,
    SANCTIONED.has(destinationCode)
      ? placeName(destination, 'destination')
      : null,
  ].filter((hit): hit is string => hit !== null);

  if (hits.length > 0) {
    return {
      title: 'Sanctions',
      evidence: `${join(hits)} ${hits.length === 1 ? 'is' : 'are'} under a broad sanctions program.`,
      points: SANCTIONED_END_POINTS,
      impact: 'critical',
    };
  }

  return clearFactor(
    'Sanctions',
    `Neither ${label(origin)} nor ${label(destination)} is under a broad sanctions program.`,
  );
}

function passageFactor(passages: string[]): RiskFactor {
  if (passages.length === 0) {
    return clearFactor(
      'Passage',
      'This sea lane does not depend on a major canal or strait in the catalog.',
    );
  }

  return {
    title: 'Passage',
    evidence: `The usual sea lane uses ${join(passages)}.`,
    points: PASSAGE_POINTS,
    impact: 'watch',
  };
}

function airspaceFactor(origin: LaneEnd, destination: LaneEnd): RiskFactor {
  const crossed = new Set<string>();
  for (const point of track(origin, destination)) {
    for (const box of AIRSPACE) {
      if (
        point.lat >= box.south &&
        point.lat <= box.north &&
        point.lon >= box.west &&
        point.lon <= box.east
      ) {
        crossed.add(box.name);
      }
    }
  }

  const names = [...crossed];
  if (names.length === 0) {
    return clearFactor(
      'Airspace',
      'The direct air track avoids the restricted airspace in the catalog.',
    );
  }

  return {
    title: 'Airspace',
    evidence: `The direct air track crosses ${join(names)}.`,
    points: AIRSPACE_POINTS,
    impact: 'elevated',
  };
}

function seaExposure(from: Basin, to: Basin): Exposure {
  const piracy = new Set<string>();
  const geopolitical = new Set<string>();
  const passages = new Set<string>();

  if (links(from, to, ASIA, [...EUROPE, 'east_africa'])) {
    passages.add('Malacca').add('Suez');
    piracy.add('the Malacca Strait').add('the Gulf of Aden');
    geopolitical.add('the Red Sea');
  }

  if (
    links(
      from,
      to,
      ['gulf'],
      [...EUROPE, 'med', 'us_east', 'east_africa', ...ASIA],
    )
  ) {
    passages.add('Hormuz');
    geopolitical.add('the Strait of Hormuz');
    if (
      links(from, to, ['gulf'], [...EUROPE, 'med', 'us_east', 'east_africa'])
    ) {
      piracy.add('the Gulf of Aden');
      geopolitical.add('the Red Sea');
      passages.add('Suez');
    }
  }

  if (
    links(from, to, ['west_africa'], [...EUROPE, 'med', 'us_east', 'caribbean'])
  ) {
    piracy.add('the Gulf of Guinea');
  }

  if (links(from, to, ['black_sea'], [...EUROPE, 'med'])) {
    passages.add('the Bosporus');
    geopolitical.add('the Black Sea');
  }

  if (links(from, to, ASIA, ['us_east', 'caribbean'])) {
    passages.add('Panama');
    geopolitical.add('the South China Sea');
  }

  if (
    links(
      from,
      to,
      ['east_asia', 'se_asia'],
      ['us_west', 'oceania', 'south_america_west'],
    )
  ) {
    geopolitical.add('the South China Sea');
  }

  if (from === to && from === 'west_africa') {
    piracy.add('the Gulf of Guinea');
  }
  if (from === to && (from === 'se_asia' || from === 'east_asia')) {
    piracy.add('the Malacca Strait');
    geopolitical.add('the South China Sea');
  }
  if (from === to && (from === 'red_sea' || from === 'gulf')) {
    piracy.add(from === 'gulf' ? 'the Gulf of Aden' : 'the Gulf of Aden');
    geopolitical.add(from === 'gulf' ? 'the Strait of Hormuz' : 'the Red Sea');
  }

  return {
    piracy: [...piracy],
    geopolitical: [...geopolitical],
    passages: [...passages],
  };
}

function links(
  from: Basin,
  to: Basin,
  left: readonly Basin[],
  right: readonly Basin[],
): boolean {
  return (
    (left.includes(from) && right.includes(to)) ||
    (left.includes(to) && right.includes(from))
  );
}

function conflictEnds(origin: LaneEnd, destination: LaneEnd): string[] {
  return [origin, destination].flatMap((end, index) => {
    const code = end.countryCode?.toUpperCase() ?? '';
    if (!CONFLICT.has(code)) {
      return [];
    }
    const role = index === 0 ? 'origin' : 'destination';
    return [`${label(end)}, the ${role},`];
  });
}

function basin(lat: number, lon: number): Basin {
  if (inside(lat, lon, 41, 47, 27, 42)) {
    return 'black_sea';
  }
  if (inside(lat, lon, 22, 31, 47, 58)) {
    return 'gulf';
  }
  if (inside(lat, lon, 10, 30, 32, 48)) {
    return 'red_sea';
  }
  if (inside(lat, lon, 30, 46, -6, 36)) {
    return 'med';
  }
  if (inside(lat, lon, 48, 72, -12, 32)) {
    return 'north_europe';
  }
  if (inside(lat, lon, -10, 20, -20, 16)) {
    return 'west_africa';
  }
  if (inside(lat, lon, -30, 12, 28, 52)) {
    return 'east_africa';
  }
  if (inside(lat, lon, 22, 50, 118, 150)) {
    return 'east_asia';
  }
  if (inside(lat, lon, -10, 23, 95, 122)) {
    return 'se_asia';
  }
  if (inside(lat, lon, 5, 32, 68, 95)) {
    return 'south_asia';
  }
  if (inside(lat, lon, 24, 48, -85, -66)) {
    return 'us_east';
  }
  if (inside(lat, lon, 30, 50, -126, -116)) {
    return 'us_west';
  }
  if (inside(lat, lon, 8, 28, -98, -60)) {
    return 'caribbean';
  }
  if (inside(lat, lon, -48, -10, 110, 180)) {
    return 'oceania';
  }
  if (inside(lat, lon, -40, 12, -55, -34)) {
    return 'south_america_east';
  }
  if (inside(lat, lon, -45, 12, -82, -68)) {
    return 'south_america_west';
  }
  return 'other';
}

function inside(
  lat: number,
  lon: number,
  south: number,
  north: number,
  west: number,
  east: number,
): boolean {
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

function track(
  origin: LaneEnd,
  destination: LaneEnd,
): Array<{ lat: number; lon: number }> {
  const startLat = radians(origin.lat);
  const startLon = radians(origin.lon);
  const endLat = radians(destination.lat);
  const endLon = radians(destination.lon);
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
    return [];
  }

  const points: Array<{ lat: number; lon: number }> = [];
  for (const fraction of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    const startWeight = Math.sin((1 - fraction) * angular) / Math.sin(angular);
    const endWeight = Math.sin(fraction * angular) / Math.sin(angular);
    const x =
      startWeight * Math.cos(startLat) * Math.cos(startLon) +
      endWeight * Math.cos(endLat) * Math.cos(endLon);
    const y =
      startWeight * Math.cos(startLat) * Math.sin(startLon) +
      endWeight * Math.cos(endLat) * Math.sin(endLon);
    const z = startWeight * Math.sin(startLat) + endWeight * Math.sin(endLat);
    points.push({
      lat: degrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
      lon: degrees(Math.atan2(y, x)),
    });
  }
  return points;
}

function radians(degreesValue: number): number {
  return (degreesValue * Math.PI) / 180;
}

function degrees(radiansValue: number): number {
  return (radiansValue * 180) / Math.PI;
}

function placeName(end: LaneEnd, role: 'origin' | 'destination'): string {
  return `${label(end)}, the ${role},`;
}

function label(end: LaneEnd): string {
  const name = end.country?.trim() || 'one end';
  return name.replace(/^The /, 'the ');
}

function join(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function sentence(value: string): string {
  if (!value) {
    return 'A geopolitical corridor is on this lane.';
  }
  return value.charAt(0).toUpperCase() + value.slice(1) + '.';
}

function warning(title: string, evidence: string): RiskFactor {
  return { title, evidence, points: UNPLACED_POINTS, impact: 'warning' };
}

function clearFactor(title: string, evidence: string): RiskFactor {
  return { title, evidence, points: 0, impact: 'clear' satisfies RiskImpact };
}
