import type { LaneStatus, RiskState } from '@supplyeagle/types';
import type { NewsHazard } from './signals.js';

export type RouteRiskInput = {
  news: Array<{ hazard: NewsHazard; why: string }>;
  disasters: Array<{ why: string }>;
  weather: Array<{ why: string; extreme: boolean }>;
  supplier: { level: 'watch' | 'elevated'; why: string } | null;
};

export type RouteRiskDecision = {
  laneStatus: LaneStatus;
  riskState: RiskState;
  why: string;
};

const STABLE_WHY = 'No corroborated disruption';

type Candidate = {
  rank: number;
  laneStatus: LaneStatus;
  riskState: RiskState;
  why: string;
};

export function assessRouteRisk(input: RouteRiskInput): RouteRiskDecision {
  const candidates: Candidate[] = [];

  for (const item of input.news) {
    const candidate = newsCandidate(item.hazard, item.why);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const item of input.disasters) {
    candidates.push({
      rank: 100,
      laneStatus: 'disrupted',
      riskState: 'critical',
      why: item.why,
    });
  }

  for (const item of input.weather) {
    candidates.push(
      item.extreme
        ? { rank: 50, laneStatus: 'active', riskState: 'elevated', why: item.why }
        : { rank: 30, laneStatus: 'active', riskState: 'watch', why: item.why },
    );
  }

  if (input.supplier) {
    candidates.push(
      input.supplier.level === 'elevated'
        ? { rank: 40, laneStatus: 'active', riskState: 'elevated', why: input.supplier.why }
        : { rank: 20, laneStatus: 'active', riskState: 'watch', why: input.supplier.why },
    );
  }

  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (!best || candidate.rank > best.rank) {
      best = candidate;
    }
  }

  if (!best) {
    return { laneStatus: 'active', riskState: 'stable', why: STABLE_WHY };
  }

  return { laneStatus: best.laneStatus, riskState: best.riskState, why: best.why };
}

function newsCandidate(hazard: NewsHazard, why: string): Candidate | null {
  switch (hazard) {
    case 'closure':
      return { rank: 100, laneStatus: 'disrupted', riskState: 'critical', why };
    case 'congestion':
      return { rank: 80, laneStatus: 'active', riskState: 'elevated', why };
    case 'strike':
      return { rank: 70, laneStatus: 'active', riskState: 'elevated', why };
    case 'conflict':
      return { rank: 60, laneStatus: 'active', riskState: 'elevated', why };
    case 'storm':
      return null;
    default: {
      const unexpected: never = hazard;
      return unexpected;
    }
  }
}
