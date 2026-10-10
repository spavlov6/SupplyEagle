import type {
  AnalysisConfidence,
  AnalysisStatus,
  SourceCheckStatus,
} from './supplier.js';

export type ShippingMode = 'air' | 'sea';

export type LaneStatus = 'active' | 'disrupted';

export type RiskState = 'critical' | 'elevated' | 'watch' | 'stable';

export type RouteSourceName =
  | 'google_news'
  | 'reliefweb'
  | 'open_meteo'
  | 'met_norway'
  | 'gdacs'
  | 'eonet'
  | 'usgs'
  | 'supplier_propagation';

export type RouteSourceCategory = 'news' | 'weather' | 'disaster' | 'supplier';

export type RouteAgreement = 'confirmed' | 'clear' | 'unverified';

export type RoutePlace = 'origin' | 'destination';

export type RouteNewsItem = {
  kind: 'news';
  place: RoutePlace;
  hazard: string;
  headline: string;
  url: string | null;
};

export type RouteWeatherItem = {
  kind: 'weather';
  place: RoutePlace;
  windKmh: number | null;
  waveHeightM: number | null;
  visibilityM: number | null;
};

export type RouteDisasterItem = {
  kind: 'disaster';
  place: RoutePlace;
  hazard: string;
  headline: string;
  url: string | null;
};

export type RouteSupplierItem = {
  kind: 'supplier';
  name: string;
  sanctionsHit: boolean | null;
  confidence: AnalysisConfidence | null;
};

export type RouteFinding =
  RouteNewsItem | RouteWeatherItem | RouteDisasterItem | RouteSupplierItem;

export type RouteSourceFacts = {
  category: RouteSourceCategory;
  agreement: RouteAgreement | null;
  hazard: string | null;
  place: string | null;
  detail: string | null;
  items: RouteFinding[];
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
  assessedAt: string | null;
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
  items: RouteFinding[];
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

export type RouteEvent =
  RouteCreatedEvent | RouteReassessEvent | RouteAssessmentUpdatedEvent;

export type RouteAssessmentUpdatedMessage = {
  routeId: string;
};
