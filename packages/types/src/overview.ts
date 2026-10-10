export type RouteRiskCounts = {
  critical: number;
  elevated: number;
  watch: number;
  stable: number;
  unassessed: number;
};

export type OverviewResponse = {
  sanctionedSuppliers: number;
  disruptedRoutes: number;
  lastScanAt: string | null;
  routesByRisk: RouteRiskCounts;
};
