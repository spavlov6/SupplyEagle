export type RecommendationType =
  'switch_supplier' | 'diversify' | 'investigate';

export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed';

export type RecommendationPlan = {
  steps: string[];
};

export type Recommendation = {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  priority: number;
  status: RecommendationStatus;
  supplierId: string | null;
  routeId: string | null;
  supplierName: string | null;
  routeLabel: string | null;
  alternativeSupplierId: string | null;
  alternativeSupplierName: string | null;
  plan: RecommendationPlan | null;
  alertId: string | null;
  createdAt: string;
};

export type RecommendationListResponse = {
  recommendations: Recommendation[];
};

export type RecommendationCreatedMessage = {
  recommendationId: string;
};
