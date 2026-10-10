import type { AnalysisConfidence, AnalysisStatus, SourceCheckStatus } from './supplier.js';

export type ShippingMode = 'air' | 'sea';

export type LaneStatus = 'active' | 'disrupted';

export type RiskState = 'critical' | 'elevated' | 'watch' | 'stable';

export type RouteSourceName =
  | 'gdelt'
  | 'google_news'
  | 'reliefweb'
  | 'open_meteo'
  | 'met_norway'
  | 'gdacs'
  | 'eonet'
  | 'usgs'
  | 'supplier_propagation';

export type RouteSourceCategory = 'news' | 'weather' | 'disaster' | 'supplier';

export type RouteAgreement = 'confirmed' | 'unverified';

export type RouteSourceFacts = {
  category: RouteSourceCategory;
  agreement: RouteAgreement | null;
  hazard: string | null;
  place: string | null;
  detail: string | null;
};

export type CreateRouteRequest = {
  origin: string;
  destination: string;
  mode: ShippingMode;
  supplierIds: string[];
};

export type RouteListItem = {
  id: string;
  origin: string;
  destination: string;
  mode: ShippingMode;
  createdAt: string;
  analysisStatus: AnalysisStatus | null;
  laneStatus: LaneStatus | null;
  riskState: RiskState | null;
  supplierCount: number;
  transitDays: number | null;
  why: string | null;
};

export type RouteListResponse = {
  routes: RouteListItem[];
};

export type RouteLinkedSupplier = {
  id: string;
  name: string;
  confidence: AnalysisConfidence | null;
  sanctionsHit: boolean | null;
};

export type RouteSourceCheck = {
  source: RouteSourceName;
  status: SourceCheckStatus;
  label: string | null;
  url: string | null;
  category: RouteSourceCategory;
  agreement: RouteAgreement | null;
  hazard: string | null;
  place: string | null;
  detail: string | null;
  error: string | null;
};

export type RouteAssessment = {
  id: string;
  status: AnalysisStatus;
  riskState: RiskState | null;
  laneStatus: LaneStatus | null;
  transitDays: number | null;
  why: string | null;
  summary: string | null;
  error: string | null;
  sources: RouteSourceCheck[];
};

export type RouteDetail = {
  id: string;
  origin: string;
  destination: string;
  mode: ShippingMode;
  createdAt: string;
  suppliers: RouteLinkedSupplier[];
};

export type RouteDetailResponse = {
  route: RouteDetail;
  assessment: RouteAssessment | null;
};

export type RouteCreatedEvent = {
  type: 'route.created';
  userId: string;
  routeId: string;
};

export type RouteReassessEvent = {
  type: 'route.reassess';
  userId: string;
  routeId: string;
};

export type RouteAssessmentUpdatedEvent = {
  type: 'route.assessment.updated';
  userId: string;
  routeId: string;
};

export type RouteEvent = RouteCreatedEvent | RouteReassessEvent | RouteAssessmentUpdatedEvent;

export type RouteAssessmentUpdatedMessage = {
  routeId: string;
};
