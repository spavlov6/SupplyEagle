import { describe, expect, it } from 'vitest';
import {
  accountSummary,
  detectAlerts,
  draftRecommendations,
  executionPlan,
  headlinesFromFacts,
  isActiveAlert,
  type OpenAlert,
  type RouteRef,
  type SupplierCandidate,
} from './decide.js';
import { scanPattern } from './agents.js';
import type { ScanBaseline } from '@supplyeagle/types';

const supplierId = '11111111-1111-1111-1111-111111111111';
const otherId = '22222222-2222-2222-2222-222222222222';
const routeId = '33333333-3333-3333-3333-333333333333';
const otherRouteId = '44444444-4444-4444-4444-444444444444';
const thirdRouteId = '55555555-5555-5555-5555-555555555555';

function baseline(overrides: Partial<ScanBaseline> = {}): ScanBaseline {
  return {
    suppliers: [
      {
        id: supplierId,
        name: 'Northwind',
        sanctionsHit: false,
        confidence: 'verified',
      },
    ],
    routes: [
      {
        id: routeId,
        origin: 'Hamburg',
        destination: 'Rotterdam',
        riskState: 'stable',
        laneStatus: 'active',
        headlines: [],
      },
    ],
    ...overrides,
  };
}

function candidate(
  overrides: Partial<SupplierCandidate> = {},
): SupplierCandidate {
  return {
    id: otherId,
    name: 'Baltic Parts',
    confidence: 'verified',
    sanctionsHit: false,
    status: 'completed',
    ...overrides,
  };
}

describe('headlinesFromFacts', () => {
  it('ignores a stored check that has no items list', () => {
    expect(
      headlinesFromFacts({
        category: 'news',
        agreement: null,
        hazard: null,
        place: null,
        detail: null,
        items: undefined as unknown as [],
      }),
    ).toEqual([]);
  });
});

describe('detectAlerts', () => {
  it('opens a sanctions alert only when the flag becomes true', () => {
    const before = baseline();
    const after = baseline({
      suppliers: [
        {
          id: supplierId,
          name: 'Northwind',
          sanctionsHit: true,
          confidence: 'verified',
        },
      ],
    });

    expect(detectAlerts(before, after).map((alert) => alert.type)).toEqual([
      'sanctions',
    ]);
    expect(detectAlerts(after, after)).toEqual([]);
  });

  it('opens a risk alert when the rank rises and skips it when the lane is newly disrupted', () => {
    const before = baseline();
    const elevated = baseline({
      routes: [
        {
          id: routeId,
          origin: 'Hamburg',
          destination: 'Rotterdam',
          riskState: 'elevated',
          laneStatus: 'active',
          headlines: [],
        },
      ],
    });
    const disrupted = baseline({
      routes: [
        {
          id: routeId,
          origin: 'Hamburg',
          destination: 'Rotterdam',
          riskState: 'critical',
          laneStatus: 'disrupted',
          headlines: [],
        },
      ],
    });

    expect(
      detectAlerts(before, elevated).map((alert) => alert.severity),
    ).toEqual(['elevated']);
    expect(detectAlerts(before, disrupted).map((alert) => alert.type)).toEqual([
      'disruption',
    ]);
    expect(detectAlerts(disrupted, elevated)).toEqual([]);
  });

  it('opens a closure alert for a new headline and ignores a repeated one', () => {
    const headline = {
      kind: 'closure' as const,
      headline: 'Port closed',
    };
    const before = baseline();
    const after = baseline({
      routes: [
        {
          id: routeId,
          origin: 'Hamburg',
          destination: 'Rotterdam',
          riskState: 'stable',
          laneStatus: 'active',
          headlines: [headline],
        },
      ],
    });

    const opened = detectAlerts(before, after);
    expect(opened.map((alert) => alert.type)).toEqual(['closure']);
    expect(detectAlerts(after, after)).toEqual([]);
  });
});

describe('draftRecommendations', () => {
  const routes: RouteRef[] = [
    {
      id: routeId,
      origin: 'Hamburg',
      destination: 'Rotterdam',
      mode: 'sea',
      riskState: 'elevated',
      laneStatus: 'active',
      supplierIds: [supplierId],
    },
  ];

  function sanctionsAlert(): OpenAlert {
    return {
      id: 'alert-1',
      type: 'sanctions',
      severity: 'critical',
      title: 'Sanctions',
      description: 'Matched',
      supplierId,
      routeId: null,
      sourceKey: `sanctions-${supplierId}`,
    };
  }

  function laneRef(overrides: Partial<RouteRef> = {}): RouteRef {
    return {
      id: routeId,
      origin: 'Hamburg',
      destination: 'Rotterdam',
      mode: 'sea',
      riskState: 'elevated',
      laneStatus: 'active',
      supplierIds: [supplierId],
      ...overrides,
    };
  }

  function laneAlert(): OpenAlert {
    return {
      id: 'alert-lane',
      type: 'risk_increase',
      severity: 'elevated',
      title: 'Elevated',
      description: 'Risk moved from stable to elevated.',
      supplierId: null,
      routeId,
      sourceKey: 'risk',
    };
  }

  it('switches to a verified tracked supplier and diversifies when none qualifies', () => {
    const flagged = candidate({
      id: supplierId,
      name: 'Northwind',
      sanctionsHit: true,
    });
    const safer = candidate();
    const withSafer = draftRecommendations({
      alerts: [sanctionsAlert()],
      suppliers: [flagged, safer],
      routes,
    });
    expect(withSafer.drafts[0]).toMatchObject({
      type: 'switch_supplier',
      priority: 5,
      alternativeSupplierId: otherId,
    });

    const without = draftRecommendations({
      alerts: [sanctionsAlert()],
      suppliers: [flagged, candidate({ confidence: 'unverified' })],
      routes,
    });
    expect(without.drafts[0]).toMatchObject({
      type: 'diversify',
      alternativeSupplierId: null,
      priority: 4,
    });
    expect(without.finderSummary).toBe(
      'Safer supplier on file for 0 of 1 flagged suppliers.',
    );
  });

  it('prefers a verified supplier over a partial one', () => {
    const picked = draftRecommendations({
      alerts: [sanctionsAlert()],
      suppliers: [
        candidate({ id: supplierId, name: 'Northwind', sanctionsHit: true }),
        candidate({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'Partial Co',
          confidence: 'partial',
        }),
        candidate({ id: otherId, name: 'Verified Co', confidence: 'verified' }),
      ],
      routes,
    });
    expect(picked.drafts[0]?.alternativeSupplierId).toBe(otherId);
  });

  it('leaves a watch alert without a recommendation and investigates higher risk', () => {
    const watch: OpenAlert = {
      id: 'alert-watch',
      type: 'risk_increase',
      severity: 'watch',
      title: 'Watch',
      description: 'Risk moved',
      supplierId: null,
      routeId,
      sourceKey: 'risk',
    };
    const elevated: OpenAlert = {
      ...watch,
      id: 'alert-high',
      severity: 'elevated',
    };

    expect(
      draftRecommendations({ alerts: [watch], suppliers: [], routes }).drafts,
    ).toEqual([]);
    expect(
      draftRecommendations({ alerts: [elevated], suppliers: [], routes })
        .drafts[0],
    ).toMatchObject({
      type: 'investigate',
      priority: 3,
      routeId,
      alternativeRouteId: null,
    });
  });

  it('switches a troubled lane onto a stable route with the same ends', () => {
    const drafted = draftRecommendations({
      alerts: [laneAlert()],
      suppliers: [],
      routes: [
        routes[0] ?? laneRef(),
        laneRef({
          id: otherRouteId,
          mode: 'air',
          riskState: 'stable',
        }),
      ],
    });

    expect(drafted.drafts[0]).toMatchObject({
      type: 'switch_route',
      priority: 4,
      routeId,
      alternativeSupplierId: null,
      alternativeRouteId: otherRouteId,
      title: 'Ship Hamburg to Rotterdam by air instead',
      description:
        'Risk moved from stable to elevated. Hamburg to Rotterdam by air is already on this account and is stable.',
    });
    expect(drafted.drafts).toHaveLength(1);
  });

  it('prefers the same ends over a quieter lane that only shares a port', () => {
    const drafted = draftRecommendations({
      alerts: [laneAlert()],
      suppliers: [],
      routes: [
        laneRef({ mode: 'air' }),
        laneRef({
          id: otherRouteId,
          mode: 'sea',
          riskState: 'watch',
        }),
        laneRef({
          id: thirdRouteId,
          origin: 'Hamburg',
          destination: 'Oslo',
          riskState: 'stable',
          supplierIds: [],
        }),
      ],
    });

    expect(drafted.drafts[0]?.alternativeRouteId).toBe(otherRouteId);
  });

  it('prefers a stable shared supplier over a watch shared supplier', () => {
    const drafted = draftRecommendations({
      alerts: [laneAlert()],
      suppliers: [],
      routes: [
        laneRef({ origin: 'Shanghai', destination: 'Hamburg' }),
        laneRef({
          id: otherRouteId,
          origin: 'Oslo',
          destination: 'Helsinki',
          riskState: 'watch',
        }),
        laneRef({
          id: thirdRouteId,
          origin: 'Busan',
          destination: 'Genoa',
          riskState: 'stable',
        }),
      ],
    });

    expect(drafted.drafts[0]?.alternativeRouteId).toBe(thirdRouteId);
  });

  it('keeps a review when no safer related lane is on the account', () => {
    const drafted = draftRecommendations({
      alerts: [laneAlert()],
      suppliers: [],
      routes: [
        routes[0] ?? laneRef(),
        laneRef({
          id: otherRouteId,
          origin: 'Tokyo',
          destination: 'Los Angeles',
          riskState: 'stable',
          supplierIds: [otherId],
        }),
        laneRef({
          id: thirdRouteId,
          mode: 'air',
          riskState: 'critical',
          laneStatus: 'disrupted',
        }),
      ],
    });

    expect(drafted.drafts[0]).toMatchObject({
      type: 'investigate',
      alternativeRouteId: null,
    });
  });

  it('recommends a safer lane that is already on the account without a new alert', () => {
    const drafted = draftRecommendations({
      alerts: [],
      suppliers: [],
      routes: [
        laneRef({
          origin: 'Shanghai',
          destination: 'Rotterdam',
          riskState: 'elevated',
        }),
        laneRef({
          id: otherRouteId,
          origin: 'Hamburg',
          destination: 'Rotterdam',
          riskState: 'watch',
          supplierIds: [otherId],
        }),
        laneRef({
          id: thirdRouteId,
          origin: 'Beijing',
          destination: 'New York',
          mode: 'air',
          riskState: 'elevated',
        }),
      ],
    });

    expect(drafted.drafts).toEqual([
      expect.objectContaining({
        alertId: null,
        type: 'switch_route',
        routeId,
        alternativeRouteId: otherRouteId,
        title: 'Use Hamburg to Rotterdam instead of Shanghai to Rotterdam',
        description:
          'Shanghai to Rotterdam is elevated. Hamburg to Rotterdam by sea is already on this account and is watch.',
      }),
    ]);
  });

  it('does not repeat a route switch that was already recommended', () => {
    const routes = [
      laneRef({ riskState: 'elevated' }),
      laneRef({
        id: otherRouteId,
        mode: 'air',
        riskState: 'stable',
      }),
    ];

    expect(
      draftRecommendations({
        alerts: [],
        suppliers: [],
        routes,
        coveredRouteIds: [routeId],
      }).drafts,
    ).toEqual([]);
  });

  it('does not switch a watch lane onto a quieter one', () => {
    expect(
      draftRecommendations({
        alerts: [],
        suppliers: [],
        routes: [
          laneRef({ riskState: 'watch' }),
          laneRef({
            id: otherRouteId,
            mode: 'air',
            riskState: 'stable',
          }),
        ],
      }).drafts,
    ).toEqual([]);
  });
});

describe('schedule and plans', () => {
  it('builds a daily cron from the saved clock', () => {
    expect(scanPattern(8, 0)).toBe('0 8 * * *');
    expect(scanPattern(8, 5)).toBe('5 8 * * *');
  });

  it('treats open and acknowledged alerts as active', () => {
    expect(isActiveAlert('open')).toBe(true);
    expect(isActiveAlert('acknowledged')).toBe(true);
    expect(isActiveAlert('dismissed')).toBe(false);
  });

  it('writes the account sentence and a three-step plan', () => {
    expect(
      accountSummary({
        critical: 1,
        elevated: 0,
        watch: 2,
        stable: 3,
        sanctioned: 1,
      }),
    ).toBe(
      '1 sanctioned supplier. Routes: 1 critical, 0 elevated, 2 watch, 3 stable.',
    );
    expect(executionPlan('investigate').steps).toHaveLength(3);
    expect(executionPlan('switch_supplier').steps).toHaveLength(3);
    expect(executionPlan('switch_route').steps).toHaveLength(3);
  });
});
