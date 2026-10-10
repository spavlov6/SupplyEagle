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
    ).toMatchObject({ type: 'investigate', priority: 3, routeId });
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
  });
});
