export type CreateSupplierRequest = {
  name: string;
};

export type AnalysisStatus = 'queued' | 'running' | 'completed' | 'failed';

export type AnalysisConfidence =
  | 'verified'
  | 'partial'
  | 'conflicting'
  | 'unverified';

export type SourceName = 'opensanctions' | 'gleif' | 'wikidata';

export type SourceCheckStatus = 'pending' | 'found' | 'not_found' | 'error';

export type SourceFacts = {
  legalName: string | null;
  country: string | null;
  sanctionsHit: boolean | null;
  matched: boolean;
  lei?: string | null;
  city?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  founded?: string | null;
  entityStatus?: string | null;
  website?: string | null;
  description?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  country: string | null;
  createdAt: string;
  analysisStatus: AnalysisStatus | null;
  confidence: AnalysisConfidence | null;
  sanctionsHit: boolean | null;
};

export type SupplierListResponse = {
  suppliers: Supplier[];
};

export type SupplierSourceCheck = {
  source: SourceName;
  status: SourceCheckStatus;
  label: string | null;
  url: string | null;
  country: string | null;
  sanctionsHit: boolean | null;
  lei: string | null;
  city: string | null;
  address: string | null;
  registrationNumber: string | null;
  founded: string | null;
  entityStatus: string | null;
  website: string | null;
  description: string | null;
  error: string | null;
};

export type SupplierAnalysis = {
  id: string;
  status: AnalysisStatus;
  confidence: AnalysisConfidence | null;
  summary: string | null;
  legalName: string | null;
  country: string | null;
  sanctionsHit: boolean | null;
  error: string | null;
  sources: SupplierSourceCheck[];
};

export type SupplierDetailResponse = {
  supplier: Supplier;
  analysis: SupplierAnalysis | null;
};

export type SupplierCreatedEvent = {
  type: 'supplier.created';
  userId: string;
  supplierId: string;
};

export type SupplierReassessEvent = {
  type: 'supplier.reassess';
  userId: string;
  supplierId: string;
};

export type AnalysisUpdatedEvent = {
  type: 'analysis.updated';
  userId: string;
  supplierId: string;
};

export type SupplierEvent =
  | SupplierCreatedEvent
  | SupplierReassessEvent
  | AnalysisUpdatedEvent;

export type AnalysisUpdatedMessage = {
  supplierId: string;
};
