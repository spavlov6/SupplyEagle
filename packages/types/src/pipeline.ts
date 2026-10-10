import type { LaneStatus, RiskState } from './route.js';
import type { AnalysisConfidence } from './supplier.js';

export type AgentName =
  | 'monitoring'
  | 'anomaly_detector'
  | 'supply_risk'
  | 'supplier_finder'
  | 'decision'
  | 'execution';

export type PipelineRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type PipelineStageStatus =
  'pending' | 'running' | 'completed' | 'failed';

export type PipelineProgressKind = 'supplier' | 'route';

export type PipelineSchedule = {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  nextRunAt: string | null;
};

export type UpdatePipelineScheduleRequest = {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
};

export type PipelineStage = {
  agentName: AgentName;
  status: PipelineStageStatus;
  summary: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type PipelineRun = {
  id: string;
  status: PipelineRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  stages: PipelineStage[];
};

export type PipelineStatusResponse = {
  schedule: PipelineSchedule;
  activeRun: PipelineRun | null;
  latestRun: PipelineRun | null;
};

export type PipelineRunListResponse = {
  runs: PipelineRun[];
};

export type MonitoredHeadline = {
  kind: 'disaster' | 'closure';
  headline: string;
};

export type SupplierBaseline = {
  id: string;
  name: string;
  sanctionsHit: boolean | null;
  confidence: AnalysisConfidence | null;
};

export type RouteBaseline = {
  id: string;
  origin: string;
  destination: string;
  riskState: RiskState | null;
  laneStatus: LaneStatus | null;
  headlines: MonitoredHeadline[];
};

export type ScanBaseline = {
  suppliers: SupplierBaseline[];
  routes: RouteBaseline[];
};

export type PipelineRequestedEvent = {
  type: 'pipeline.requested';
  userId: string;
  runId: string;
};

export type ScheduleUpdatedEvent = {
  type: 'schedule.updated';
  userId: string;
};

export type ScheduleAppliedEvent = {
  type: 'schedule.applied';
  userId: string;
};

export type PipelineStartedEvent = {
  type: 'pipeline.started';
  userId: string;
  runId: string;
};

export type PipelineStageEvent = {
  type: 'pipeline.stage';
  userId: string;
  runId: string;
  agentName: AgentName;
  status: PipelineStageStatus;
  summary: string | null;
  done: number | null;
  total: number | null;
  kind: PipelineProgressKind | null;
};

export type PipelineCompletedEvent = {
  type: 'pipeline.completed';
  userId: string;
  runId: string;
  status: 'completed' | 'failed';
};

export type AlertCreatedEvent = {
  type: 'alert.created';
  userId: string;
  alertId: string;
};

export type RecommendationCreatedEvent = {
  type: 'recommendation.created';
  userId: string;
  recommendationId: string;
};

export type PipelineEvent =
  | PipelineRequestedEvent
  | ScheduleUpdatedEvent
  | ScheduleAppliedEvent
  | PipelineStartedEvent
  | PipelineStageEvent
  | PipelineCompletedEvent
  | AlertCreatedEvent
  | RecommendationCreatedEvent;

export type PipelineStartedMessage = {
  runId: string;
};

export type PipelineStageMessage = {
  runId: string;
  agentName: AgentName;
  status: PipelineStageStatus;
  summary: string | null;
  done: number | null;
  total: number | null;
  kind: PipelineProgressKind | null;
};

export type PipelineCompletedMessage = {
  runId: string;
  status: 'completed' | 'failed';
};
