import { describe, expect, it } from 'vitest';
import type { LaneEnd } from './corridor';
import { scoreLane, scoreSupplier, type SupplierScoreInput } from './score';

function end(
  country: string,
  countryCode: string,
  lat: number,
  lon: number,
): LaneEnd {
  return { country, countryCode, lat, lon };
}

const shanghai = end('China', 'CN', 31.23, 121.47);
const rotterdam = end('Netherlands', 'NL', 51.92, 4.48);
const newYork = end('United States', 'US', 40.71, -74.01);
const bandarAbbas = end('Iran', 'IR', 27.18, 56.28);

function supplierInput(
  overrides: Partial<SupplierScoreInput> = {},
): SupplierScoreInput {
  return {
    confidence: 'verified',
    sanctionsHit: false,
    sources: [
      {
        source: 'opensanctions',
        status: 'not_found',
        entityStatus: null,
        label: null,
      },
      { source: 'gleif', status: 'found', entityStatus: 'ACTIVE', label: null },
      { source: 'wikidata', status: 'found', entityStatus: null, label: null },
    ],
    ...overrides,
  };
}

describe('route corridor score', () => {
  it('scores a Shanghai to Rotterdam sea lane from piracy, the Red Sea, and canals', () => {
    const score = scoreLane({
      mode: 'sea',
      origin: shanghai,
      destination: rotterdam,
    });
    expect(score.factors.map((factor) => factor.title)).toEqual([
      'Piracy',
      'Geopolitical',
      'Sanctions',
      'Passage',
    ]);
    expect(score.factors[0]).toMatchObject({ points: 28, impact: 'watch' });
    expect(score.factors[0]?.evidence).toContain('Gulf of Aden');
    expect(score.factors[1]).toMatchObject({ points: 40, impact: 'elevated' });
    expect(score.factors[1]?.evidence).toContain('Red Sea');
    expect(score.factors[2]).toMatchObject({ points: 0, impact: 'clear' });
    expect(score.factors[3]?.evidence).toContain('Suez');
    expect(score.total).toBe(90);
    expect(score.band).toBe('critical');
  });

  it('scores an air lane on shared factors and airspace, not piracy', () => {
    const score = scoreLane({
      mode: 'air',
      origin: shanghai,
      destination: rotterdam,
    });
    expect(score.factors.map((factor) => factor.title)).toEqual([
      'Geopolitical',
      'Sanctions',
      'Airspace',
    ]);
    expect(score.factors[2]).toMatchObject({
      title: 'Airspace',
      points: 40,
      impact: 'elevated',
    });
    expect(score.factors[2]?.evidence).toContain('Russian airspace');
    expect(score.factors[1]?.points).toBe(0);
    expect(score.total).toBe(40);
    expect(score.band).toBe('elevated');
  });

  it('omits piracy when an air lane cannot be placed', () => {
    const score = scoreLane({ mode: 'air', origin: null, destination: null });
    expect(score.factors.map((factor) => factor.title)).toEqual([
      'Geopolitical',
      'Sanctions',
      'Airspace',
    ]);
    expect(score.band).toBe('stable');
  });

  it('keeps a north Atlantic sea lane clear', () => {
    const score = scoreLane({
      mode: 'sea',
      origin: rotterdam,
      destination: newYork,
    });
    expect(score.total).toBe(0);
    expect(score.band).toBe('stable');
  });

  it('treats a sanctioned gulf origin as critical', () => {
    const score = scoreLane({
      mode: 'sea',
      origin: bandarAbbas,
      destination: rotterdam,
    });
    expect(score.factors[2]).toMatchObject({
      title: 'Sanctions',
      points: 70,
      impact: 'critical',
    });
    expect(score.factors[2]?.evidence).toContain('Iran');
    expect(score.factors[1]?.evidence).toContain('Hormuz');
    expect(score.band).toBe('critical');
  });

  it('warns when the lane cannot be placed', () => {
    const score = scoreLane({ mode: 'sea', origin: null, destination: null });
    expect(score.factors[1]).toMatchObject({ impact: 'warning', points: 8 });
    expect(score.factors[2]).toMatchObject({ impact: 'warning', points: 8 });
    expect(score.band).toBe('stable');
  });
});

describe('supplier risk score', () => {
  it('scores a verified clear supplier at zero', () => {
    const score = scoreSupplier(supplierInput());
    expect(score.total).toBe(0);
    expect(score.band).toBe('stable');
    expect(score.factors).toHaveLength(4);
  });

  it('scores an unverified sanctions-clear supplier as watch', () => {
    const score = scoreSupplier(
      supplierInput({ confidence: 'unverified', sanctionsHit: false }),
    );
    expect(score.total).toBe(28);
    expect(score.band).toBe('watch');
    expect(score.factors[1]).toMatchObject({
      title: 'Identity',
      points: 28,
      impact: 'watch',
    });
  });

  it('scores a sanctions hit plus partial identity as critical', () => {
    const score = scoreSupplier(
      supplierInput({
        confidence: 'partial',
        sanctionsHit: true,
        sources: [
          {
            source: 'opensanctions',
            status: 'found',
            entityStatus: null,
            label: 'Rheinmetall Ag',
          },
          {
            source: 'gleif',
            status: 'not_found',
            entityStatus: null,
            label: null,
          },
          {
            source: 'wikidata',
            status: 'found',
            entityStatus: null,
            label: null,
          },
        ],
      }),
    );

    expect(score.total).toBe(92);
    expect(score.band).toBe('critical');
    expect(score.factors[0]).toMatchObject({
      evidence: 'OpenSanctions matched Rheinmetall Ag',
      points: 70,
      impact: 'critical',
    });
  });

  it('scores an inactive registry and failed sources', () => {
    const inactive = scoreSupplier(
      supplierInput({
        sources: [
          {
            source: 'opensanctions',
            status: 'not_found',
            entityStatus: null,
            label: null,
          },
          {
            source: 'gleif',
            status: 'found',
            entityStatus: 'inactive',
            label: null,
          },
          {
            source: 'wikidata',
            status: 'found',
            entityStatus: null,
            label: null,
          },
        ],
      }),
    );
    expect(inactive.factors[2]).toMatchObject({ points: 20, impact: 'watch' });
    expect(inactive.total).toBe(20);

    const gaps = scoreSupplier(
      supplierInput({
        sources: [
          {
            source: 'opensanctions',
            status: 'error',
            entityStatus: null,
            label: null,
          },
          { source: 'gleif', status: 'error', entityStatus: null, label: null },
          {
            source: 'wikidata',
            status: 'error',
            entityStatus: null,
            label: null,
          },
        ],
      }),
    );
    expect(gaps.factors[3]).toMatchObject({
      points: 24,
      impact: 'warning',
      evidence: '3 sources could not be checked',
    });
  });

  it('warns when sanctions are unknown', () => {
    const score = scoreSupplier(supplierInput({ sanctionsHit: null }));
    expect(score.factors[0]).toMatchObject({
      points: 12,
      impact: 'warning',
    });
  });
});
