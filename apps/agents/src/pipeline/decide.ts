import { createHash } from 'node:crypto';
import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  AnalysisConfidence,
  AnalysisStatus,
  MonitoredHeadline,
  RecommendationPlan,
  LaneStatus,
  RecommendationType,
  RiskState,
  RouteBaseline,
  ShippingMode,
  RouteSourceFacts,
  ScanBaseline,
  SupplierBaseline,
} from '@supplyeagle/types';

const RISK_RANK: Record<RiskState, number> = {
  stable: 0,
  watch: 1,
  elevated: 2,
  critical: 3,
};

export type AlertDraft = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  supplierId: string | null;
  routeId: string | null;
  sourceKey: string;
};

export type SupplierCandidate = {
  id: string;
  name: string;
  confidence: AnalysisConfidence | null;
  sanctionsHit: boolean | null;
  status: AnalysisStatus | null;
};

export type RouteRef = {
  id: string;
  origin: string;
  destination: string;
  mode: ShippingMode;
  riskState: RiskState | null;
  laneStatus: LaneStatus | null;
  supplierIds: string[];
};

export type OpenAlert = AlertDraft & {
  id: string;
};

export type DraftRecommendation = {
  alertId: string | null;
  type: RecommendationType;
  priority: number;
  title: string;
  description: string;
  supplierId: string | null;
  routeId: string | null;
  alternativeSupplierId: string | null;
  alternativeRouteId: string | null;
};

export function riskRank(state: RiskState | null): number {
  if (!state) {
    return 0;
  }

  switch (state) {
    case 'stable':
    case 'watch':
    case 'elevated':
    case 'critical':
      return RISK_RANK[state];
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
}

export function isActiveAlert(status: AlertStatus): boolean {
  switch (status) {
    case 'open':
    case 'acknowledged':
      return true;
    case 'dismissed':
      return false;
    default: {
      const unexpected: never = status;
      return unexpected;
    }
  }
}

export function headlinesFromFacts(
  facts: RouteSourceFacts | null,
): MonitoredHeadline[] {
  if (!facts || !Array.isArray(facts.items)) {
    return [];
  }

  const headlines: MonitoredHeadline[] = [];
  for (const item of facts.items) {
    if (item.kind === 'disaster') {
      headlines.push({ kind: 'disaster', headline: item.headline });
    } else if (item.kind === 'news' && item.hazard === 'closure') {
      headlines.push({ kind: 'closure', headline: item.headline });
    }
  }

  return headlines;
}

export function detectAlerts(
  before: ScanBaseline,
  after: ScanBaseline,
): AlertDraft[] {
  const drafts: AlertDraft[] = [];
  const previousSuppliers = new Map(
    before.suppliers.map((supplier) => [supplier.id, supplier]),
  );
  for (const supplier of after.suppliers) {
    const prior = previousSuppliers.get(supplier.id) ?? {
      id: supplier.id,
      name: supplier.name,
      sanctionsHit: null,
      confidence: null,
    };
    drafts.push(...supplierAlerts(prior, supplier));
  }

  const previousRoutes = new Map(
    before.routes.map((route) => [route.id, route]),
  );
  for (const route of after.routes) {
    const prior = previousRoutes.get(route.id) ?? {
      id: route.id,
      origin: route.origin,
      destination: route.destination,
      riskState: null,
      laneStatus: null,
      headlines: [],
    };
    drafts.push(...routeAlerts(prior, route));
  }

  return drafts;
}

export function supplierAlerts(
  before: SupplierBaseline,
  after: SupplierBaseline,
): AlertDraft[] {
  if (before.sanctionsHit === true || after.sanctionsHit !== true) {
    return [];
  }

  return [
    {
      type: 'sanctions',
      severity: 'critical',
      title: `Sanctions record for ${after.name}`,
      description: `${after.name} matched a sanctions record on the latest check.`,
      supplierId: after.id,
      routeId: null,
      sourceKey: `sanctions-${after.id}`,
    },
  ];
}

export function routeAlerts(
  before: RouteBaseline,
  after: RouteBaseline,
): AlertDraft[] {
  const drafts: AlertDraft[] = [];
  const lane = `${after.origin} to ${after.destination}`;
  const becameDisrupted =
    before.laneStatus !== 'disrupted' && after.laneStatus === 'disrupted';

  if (becameDisrupted) {
    drafts.push({
      type: 'disruption',
      severity: 'critical',
      title: `${lane} is disrupted`,
      description: 'The lane status changed to disrupted.',
      supplierId: null,
      routeId: after.id,
      sourceKey: `lane-${after.id}-disrupted`,
    });
  }

  const afterRank = riskRank(after.riskState);
  if (
    after.riskState &&
    after.riskState !== 'stable' &&
    afterRank > riskRank(before.riskState) &&
    !becameDisrupted
  ) {
    drafts.push({
      type: 'risk_increase',
      severity: severityForRisk(after.riskState),
      title: `${lane} is ${after.riskState}`,
      description: `Risk moved from ${before.riskState ?? 'unassessed'} to ${after.riskState}.`,
      supplierId: null,
      routeId: after.id,
      sourceKey: `risk-${after.id}-${after.riskState}`,
    });
  }

  const seen = new Set(
    before.headlines.map((item) => `${item.kind}:${item.headline}`),
  );
  for (const item of after.headlines) {
    if (seen.has(`${item.kind}:${item.headline}`)) {
      continue;
    }

    drafts.push(headlineAlert(after, item));
  }

  return drafts;
}

export function accountSummary(input: {
  critical: number;
  elevated: number;
  watch: number;
  stable: number;
  sanctioned: number;
}): string {
  const sanctioned =
    input.sanctioned === 1
      ? '1 sanctioned supplier'
      : `${input.sanctioned} sanctioned suppliers`;
  return `${sanctioned}. Routes: ${input.critical} critical, ${input.elevated} elevated, ${input.watch} watch, ${input.stable} stable.`;
}

export function draftRecommendations(input: {
  alerts: OpenAlert[];
  suppliers: SupplierCandidate[];
  routes: RouteRef[];
  coveredRouteIds?: string[];
}): { drafts: DraftRecommendation[]; finderSummary: string } {
  const routes = new Map(input.routes.map((route) => [route.id, route]));
  const flagged = new Set<string>();
  for (const alert of input.alerts) {
    if (alert.type === 'sanctions' && alert.supplierId) {
      flagged.add(alert.supplierId);
    }
    if (alert.routeId && isLaneAlert(alert.type)) {
      for (const supplierId of routes.get(alert.routeId)?.supplierIds ?? []) {
        flagged.add(supplierId);
      }
    }
  }

  const alternatives = new Map<string, SupplierCandidate | null>();
  for (const supplierId of flagged) {
    alternatives.set(supplierId, pickAlternative(input.suppliers, supplierId));
  }

  const found = [...alternatives.values()].filter(
    (candidate) => candidate !== null,
  ).length;
  const finderSummary =
    flagged.size === 0
      ? 'No sanctioned or disrupted suppliers to search.'
      : `Safer supplier on file for ${found} of ${flagged.size} flagged suppliers.`;

  const drafts: DraftRecommendation[] = [];
  for (const alert of input.alerts) {
    const draft = draftForAlert(alert, alternatives, routes, input.suppliers);
    if (draft) {
      drafts.push(draft);
    }
  }

  const switched = new Set(
    drafts
      .map((draft) => (draft.type === 'switch_route' ? draft.routeId : null))
      .filter((routeId): routeId is string => routeId !== null),
  );
  const covered = new Set(input.coveredRouteIds ?? []);
  for (const route of input.routes) {
    if (
      switched.has(route.id) ||
      covered.has(route.id) ||
      !holdsVolume(route)
    ) {
      continue;
    }
    const alternative = pickAlternativeRoute(input.routes, route.id);
    if (!alternative) {
      continue;
    }
    drafts.push(
      routeSwitchDraft(null, route, alternative, standingLead(route)),
    );
    switched.add(route.id);
  }

  return { drafts, finderSummary };
}

export function recommendationCopyId(draft: DraftRecommendation): string {
  return (
    draft.alertId ??
    `route-${draft.routeId ?? draft.alternativeRouteId ?? 'switch'}`
  );
}

export function executionPlan(type: RecommendationType): RecommendationPlan {
  switch (type) {
    case 'switch_supplier':
      return {
        steps: [
          'Confirm the sanctions evidence on the current supplier.',
          'Decide whether to move volume to the named supplier already on this account.',
          'Record the outcome on the recommendation.',
        ],
      };
    case 'diversify':
      return {
        steps: [
          'Confirm the sanctions evidence on the current supplier.',
          'Add another checked supplier to this account before moving volume.',
          'Record the outcome on the recommendation.',
        ],
      };
    case 'switch_route':
      return {
        steps: [
          'Confirm the evidence on the current lane.',
          'Decide whether to move volume onto the named route already on this account.',
          'Record the outcome on the recommendation.',
        ],
      };
    case 'investigate':
      return {
        steps: [
          'Confirm the evidence on the named supplier or lane.',
          'Decide whether that supplier or lane stays in use.',
          'Record the outcome on the recommendation.',
        ],
      };
    default: {
      const unexpected: never = type;
      return unexpected;
    }
  }
}

export function pickAlternative(
  candidates: SupplierCandidate[],
  excludeId: string,
): SupplierCandidate | null {
  const eligible = candidates.filter(
    (candidate) =>
      candidate.id !== excludeId &&
      candidate.status === 'completed' &&
      candidate.sanctionsHit === false &&
      (candidate.confidence === 'verified' ||
        candidate.confidence === 'partial'),
  );
  eligible.sort((left, right) => {
    if (left.confidence !== right.confidence) {
      return left.confidence === 'verified' ? -1 : 1;
    }

    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id);
  });

  return eligible[0] ?? null;
}

export function pickAlternativeRoute(
  routes: RouteRef[],
  routeId: string,
): RouteRef | null {
  const current = routes.find((route) => route.id === routeId);
  if (!current) {
    return null;
  }

  const eligible = routes.filter((route) => isAlternativeRoute(current, route));
  eligible.sort((left, right) => compareAlternatives(current, left, right));
  return eligible[0] ?? null;
}

function draftForAlert(
  alert: OpenAlert,
  alternatives: Map<string, SupplierCandidate | null>,
  routes: Map<string, RouteRef>,
  suppliers: SupplierCandidate[],
): DraftRecommendation | null {
  if (alert.type === 'sanctions') {
    if (!alert.supplierId) {
      return null;
    }

    const alternative = alternatives.get(alert.supplierId) ?? null;
    const name =
      suppliers.find((supplier) => supplier.id === alert.supplierId)?.name ??
      'This supplier';
    if (alternative) {
      return {
        alertId: alert.id,
        type: 'switch_supplier',
        priority: 5,
        title: `Review a switch away from ${name}`,
        description: `${name} has a sanctions record. ${alternative.name} is already on this account and is not sanctioned.`,
        supplierId: alert.supplierId,
        routeId: null,
        alternativeSupplierId: alternative.id,
        alternativeRouteId: null,
      };
    }

    return {
      alertId: alert.id,
      type: 'diversify',
      priority: 4,
      title: `Diversify away from ${name}`,
      description: `${name} has a sanctions record. No safer supplier on this account is on file.`,
      supplierId: alert.supplierId,
      routeId: null,
      alternativeSupplierId: null,
      alternativeRouteId: null,
    };
  }

  if (alert.type === 'risk_increase' && alert.severity === 'watch') {
    return null;
  }

  if (
    alert.type === 'disruption' ||
    alert.type === 'closure' ||
    alert.type === 'disaster' ||
    alert.type === 'risk_increase'
  ) {
    const route = alert.routeId ? routes.get(alert.routeId) : undefined;
    const lane = route ? laneLabel(route) : 'This lane';
    const alternativeRoute = alert.routeId
      ? pickAlternativeRoute([...routes.values()], alert.routeId)
      : null;
    if (alternativeRoute && route) {
      return routeSwitchDraft(
        alert.id,
        route,
        alternativeRoute,
        alert.description,
      );
    }

    const linked = route?.supplierIds ?? [];
    const alternative = linked
      .map((supplierId) => alternatives.get(supplierId) ?? null)
      .find((candidate): candidate is SupplierCandidate => candidate !== null);
    const priority = alert.severity === 'elevated' ? 3 : 4;
    const extra = alternative
      ? ` ${alternative.name} is a tracked supplier that is not sanctioned.`
      : '';
    return {
      alertId: alert.id,
      type: 'investigate',
      priority,
      title: `Review ${lane}`,
      description: `${alert.description}${extra}`,
      supplierId: null,
      routeId: alert.routeId,
      alternativeSupplierId: null,
      alternativeRouteId: null,
    };
  }

  const unexpected: never = alert.type;
  return unexpected;
}

function routeSwitchDraft(
  alertId: string | null,
  route: RouteRef,
  alternative: RouteRef,
  lead: string,
): DraftRecommendation {
  const lane = laneLabel(route);
  const moved = `${laneLabel(alternative)} by ${modeWord(alternative.mode)}`;
  const sameEnds = sameLaneEnds(route, alternative);
  return {
    alertId,
    type: 'switch_route',
    priority: 4,
    title: sameEnds
      ? `Ship ${lane} by ${modeWord(alternative.mode)} instead`
      : `Use ${laneLabel(alternative)} instead of ${lane}`,
    description: `${lead} ${moved} is already on this account and is ${usableRisk(alternative)}.`,
    supplierId: null,
    routeId: route.id,
    alternativeSupplierId: null,
    alternativeRouteId: alternative.id,
  };
}

function holdsVolume(route: RouteRef): boolean {
  if (route.laneStatus === 'disrupted') {
    return true;
  }
  return route.riskState === 'elevated' || route.riskState === 'critical';
}

function standingLead(route: RouteRef): string {
  const lane = laneLabel(route);
  if (route.laneStatus === 'disrupted') {
    return `${lane} is disrupted.`;
  }
  return `${lane} is ${route.riskState}.`;
}

function isAlternativeRoute(current: RouteRef, candidate: RouteRef): boolean {
  if (candidate.id === current.id || !usableRisk(candidate)) {
    return false;
  }
  if (
    current.riskState &&
    riskRank(candidate.riskState) >= riskRank(current.riskState)
  ) {
    return false;
  }
  return relatedLane(current, candidate);
}

function usableRisk(route: RouteRef): 'stable' | 'watch' | null {
  if (route.laneStatus !== 'active') {
    return null;
  }
  if (route.riskState === 'stable' || route.riskState === 'watch') {
    return route.riskState;
  }
  return null;
}

function relatedLane(current: RouteRef, candidate: RouteRef): boolean {
  return (
    sameLaneEnds(current, candidate) ||
    sharesSupplier(current, candidate) ||
    samePlace(current.origin, candidate.origin) ||
    samePlace(current.destination, candidate.destination)
  );
}

function compareAlternatives(
  current: RouteRef,
  left: RouteRef,
  right: RouteRef,
): number {
  const group =
    alternativeGroup(current, left) - alternativeGroup(current, right);
  if (group !== 0) {
    return group;
  }

  const risk = riskRank(left.riskState) - riskRank(right.riskState);
  if (risk !== 0) {
    return risk;
  }

  const byName = laneLabel(left).localeCompare(laneLabel(right));
  if (byName !== 0) {
    return byName;
  }

  return left.id.localeCompare(right.id);
}

function alternativeGroup(current: RouteRef, candidate: RouteRef): number {
  if (sameLaneEnds(current, candidate)) {
    return 0;
  }
  if (sharesSupplier(current, candidate)) {
    return 1;
  }
  return 2;
}

function sameLaneEnds(left: RouteRef, right: RouteRef): boolean {
  return (
    samePlace(left.origin, right.origin) &&
    samePlace(left.destination, right.destination)
  );
}

function sharesSupplier(left: RouteRef, right: RouteRef): boolean {
  return left.supplierIds.some((supplierId) =>
    right.supplierIds.includes(supplierId),
  );
}

function samePlace(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function laneLabel(route: RouteRef): string {
  return `${route.origin} to ${route.destination}`;
}

function modeWord(mode: ShippingMode): string {
  switch (mode) {
    case 'air':
      return 'air';
    case 'sea':
      return 'sea';
    default: {
      const unexpected: never = mode;
      return unexpected;
    }
  }
}

function isLaneAlert(type: AlertType): boolean {
  switch (type) {
    case 'disruption':
    case 'closure':
    case 'disaster':
      return true;
    case 'sanctions':
    case 'risk_increase':
      return false;
    default: {
      const unexpected: never = type;
      return unexpected;
    }
  }
}

function severityForRisk(state: RiskState): AlertSeverity {
  switch (state) {
    case 'critical':
      return 'critical';
    case 'elevated':
      return 'elevated';
    case 'watch':
    case 'stable':
      return 'watch';
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
}

function headlineAlert(
  route: RouteBaseline,
  item: MonitoredHeadline,
): AlertDraft {
  const lane = `${route.origin} to ${route.destination}`;
  const digest = createHash('sha256')
    .update(item.headline)
    .digest('hex')
    .slice(0, 12);
  switch (item.kind) {
    case 'closure':
      return {
        type: 'closure',
        severity: 'critical',
        title: `Closure reported on ${lane}`,
        description: item.headline,
        supplierId: null,
        routeId: route.id,
        sourceKey: `closure-${route.id}-${digest}`,
      };
    case 'disaster':
      return {
        type: 'disaster',
        severity: 'critical',
        title: `Disaster reported on ${lane}`,
        description: item.headline,
        supplierId: null,
        routeId: route.id,
        sourceKey: `disaster-${route.id}-${digest}`,
      };
    default: {
      const unexpected: never = item.kind;
      return unexpected;
    }
  }
}
