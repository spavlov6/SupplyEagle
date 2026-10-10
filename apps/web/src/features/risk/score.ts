import type {
  AnalysisConfidence,
  ShippingMode,
  SupplierSourceCheck,
} from '@supplyeagle/types';
import { corridorFactors, type LaneEnd } from './corridor';

export const SCORE_CAP = 100;
export const WARNING_POINTS = 8;

export const SANCTIONS_HIT_POINTS = 70;
export const SANCTIONS_UNKNOWN_POINTS = 12;
export const IDENTITY_CONFLICT_POINTS = 40;
export const IDENTITY_UNVERIFIED_POINTS = 28;
export const IDENTITY_PARTIAL_POINTS = 22;
export const REGISTRY_INACTIVE_POINTS = 20;
export const COVERAGE_POINT = 8;
export const COVERAGE_CAP = 24;

export type RiskImpact =
  'clear' | 'warning' | 'watch' | 'elevated' | 'critical';

export type RiskBand = 'stable' | 'watch' | 'elevated' | 'critical';

export type RiskFactor = {
  title: string;
  evidence: string;
  points: number;
  impact: RiskImpact;
};

export type RiskScore = {
  total: number;
  band: RiskBand;
  factors: RiskFactor[];
};

export type SupplierScoreInput = {
  confidence: AnalysisConfidence | null;
  sanctionsHit: boolean | null;
  sources: Array<
    Pick<SupplierSourceCheck, 'source' | 'status' | 'entityStatus' | 'label'>
  >;
};

export function scoreLane(input: {
  mode: ShippingMode;
  origin: LaneEnd | null;
  destination: LaneEnd | null;
}): RiskScore {
  return finish(corridorFactors(input));
}

export function scoreSupplier(input: SupplierScoreInput): RiskScore {
  return finish([
    sanctionsFactor(input),
    identityFactor(input.confidence),
    registryFactor(input.sources),
    coverageFactor(input.sources),
  ]);
}

export function bandFor(total: number): RiskBand {
  if (total >= 70) {
    return 'critical';
  }
  if (total >= 40) {
    return 'elevated';
  }
  if (total >= 20) {
    return 'watch';
  }
  return 'stable';
}

function finish(factors: RiskFactor[]): RiskScore {
  const raw = factors.reduce((sum, factor) => sum + factor.points, 0);
  const total = Math.min(SCORE_CAP, raw);
  return { total, band: bandFor(total), factors };
}

function sanctionsFactor(input: SupplierScoreInput): RiskFactor {
  if (input.sanctionsHit === true) {
    const label = input.sources.find(
      (source) => source.source === 'opensanctions',
    )?.label;
    return {
      title: 'Sanctions',
      evidence: label ? `OpenSanctions matched ${label}` : 'Sanctions match',
      points: SANCTIONS_HIT_POINTS,
      impact: 'critical',
    };
  }

  if (input.sanctionsHit === false) {
    return clearFactor('Sanctions', 'No sanctions match');
  }

  return {
    title: 'Sanctions',
    evidence: 'Sanctions could not be checked',
    points: SANCTIONS_UNKNOWN_POINTS,
    impact: 'warning',
  };
}

function identityFactor(confidence: AnalysisConfidence | null): RiskFactor {
  switch (confidence) {
    case 'conflicting':
      return {
        title: 'Identity',
        evidence: 'GLEIF and Wikidata disagree',
        points: IDENTITY_CONFLICT_POINTS,
        impact: 'elevated',
      };
    case 'partial':
      return {
        title: 'Identity',
        evidence: 'Only one identity source matched',
        points: IDENTITY_PARTIAL_POINTS,
        impact: 'watch',
      };
    case 'verified':
      return clearFactor('Identity', 'GLEIF and Wikidata agree');
    case 'unverified':
    case null:
      return {
        title: 'Identity',
        evidence: 'No identity source matched',
        points: IDENTITY_UNVERIFIED_POINTS,
        impact: 'watch',
      };
    default: {
      const unexpected: never = confidence;
      return unexpected;
    }
  }
}

function registryFactor(sources: SupplierScoreInput['sources']): RiskFactor {
  const status = sources.find(
    (source) => source.source === 'gleif',
  )?.entityStatus;
  if (status?.toUpperCase() === 'INACTIVE') {
    return {
      title: 'Registry',
      evidence: 'GLEIF lists the entity as inactive',
      points: REGISTRY_INACTIVE_POINTS,
      impact: 'watch',
    };
  }

  return clearFactor('Registry', 'No inactive registry record');
}

function coverageFactor(sources: SupplierScoreInput['sources']): RiskFactor {
  const failedCount = sources.filter(
    (source) => source.status === 'error',
  ).length;
  const points = Math.min(COVERAGE_CAP, failedCount * COVERAGE_POINT);
  if (points === 0) {
    return clearFactor('Coverage', 'All three sources reported');
  }

  const evidence =
    failedCount === 1
      ? '1 source could not be checked'
      : `${failedCount} sources could not be checked`;
  return {
    title: 'Coverage',
    evidence,
    points,
    impact: 'warning',
  };
}

function clearFactor(title: string, evidence: string): RiskFactor {
  return { title, evidence, points: 0, impact: 'clear' };
}
