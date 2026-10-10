import { assessRouteRisk } from './risk.js';
import { confirmedNews, propagateSuppliers } from './signals.js';

const empty = {
  news: [],
  disasters: [],
  weather: [],
  supplier: null,
};

describe('assessRouteRisk', () => {
  it('marks a confirmed closure disrupted and critical', () => {
    expect(
      assessRouteRisk({
        ...empty,
        news: [{ hazard: 'closure', why: 'Shanghai port closed' }],
      }),
    ).toEqual({
      laneStatus: 'disrupted',
      riskState: 'critical',
      why: 'Shanghai port closed',
    });
  });

  it('keeps confirmed severe weather active at watch', () => {
    expect(
      assessRouteRisk({
        ...empty,
        weather: [{ why: 'Severe wind at Shanghai', extreme: false }],
      }),
    ).toEqual({
      laneStatus: 'active',
      riskState: 'watch',
      why: 'Severe wind at Shanghai',
    });
  });

  it('raises supplier propagation without disrupting the lane', () => {
    expect(
      propagateSuppliers([
        { name: 'Clean Co', sanctionsHit: false, confidence: 'verified' },
        { name: 'Nordwind', sanctionsHit: false, confidence: 'partial' },
      ]),
    ).toEqual({
      name: 'Nordwind',
      level: 'watch',
      why: 'propagated from → Nordwind',
    });

    expect(
      assessRouteRisk({
        ...empty,
        supplier: { level: 'watch', why: 'propagated from → Nordwind' },
      }),
    ).toEqual({
      laneStatus: 'active',
      riskState: 'watch',
      why: 'propagated from → Nordwind',
    });

    expect(
      propagateSuppliers([{ name: 'Nordwind', sanctionsHit: true, confidence: 'verified' }]),
    ).toEqual({
      name: 'Nordwind',
      level: 'elevated',
      why: 'propagated from → Nordwind',
    });

    expect(
      assessRouteRisk({
        ...empty,
        supplier: { level: 'elevated', why: 'propagated from → Nordwind' },
      }),
    ).toEqual({
      laneStatus: 'active',
      riskState: 'elevated',
      why: 'propagated from → Nordwind',
    });
  });

  it('stays stable when nothing is confirmed', () => {
    expect(assessRouteRisk(empty)).toEqual({
      laneStatus: 'active',
      riskState: 'stable',
      why: 'No corroborated disruption',
    });
  });

  it('ignores a single manipulated provider', () => {
    const news = confirmedNews([
      {
        provider: 'gdelt',
        place: 'origin',
        hazard: 'closure',
        domains: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'],
        headline: 'Fabricated closure',
      },
    ]);

    expect(news).toEqual([]);
    expect(
      assessRouteRisk({
        ...empty,
        news: news.map((item) => ({ hazard: item.hazard, why: item.headline })),
      }),
    ).toEqual({
      laneStatus: 'active',
      riskState: 'stable',
      why: 'No corroborated disruption',
    });
  });

  it('lets the highest confirmed signal set why', () => {
    expect(
      assessRouteRisk({
        news: [{ hazard: 'closure', why: 'Shanghai port closed' }],
        disasters: [],
        weather: [{ why: 'Severe wind at Shanghai', extreme: false }],
        supplier: { level: 'elevated', why: 'propagated from → Nordwind' },
      }),
    ).toEqual({
      laneStatus: 'disrupted',
      riskState: 'critical',
      why: 'Shanghai port closed',
    });
  });
});
