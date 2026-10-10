import type {
  AgentName,
  PipelineEvent,
  PipelineProgressKind,
  PipelineStageStatus,
} from '@supplyeagle/types';

export const PIPELINE_EVENTS_CHANNEL = 'supplyeagle:pipeline-events';

const AGENT_NAMES = new Set<AgentName>([
  'monitoring',
  'anomaly_detector',
  'supply_risk',
  'supplier_finder',
  'decision',
  'execution',
]);

const STAGE_STATUSES = new Set<PipelineStageStatus>([
  'pending',
  'running',
  'completed',
  'failed',
]);

export function parsePipelineEvent(message: string): PipelineEvent | null {
  try {
    const value: unknown = JSON.parse(message);
    if (!isRecord(value) || typeof value.userId !== 'string') {
      return null;
    }

    switch (value.type) {
      case 'pipeline.requested':
        return typeof value.runId === 'string'
          ? { type: value.type, userId: value.userId, runId: value.runId }
          : null;
      case 'schedule.updated':
      case 'schedule.applied':
        return { type: value.type, userId: value.userId };
      case 'pipeline.started':
        return typeof value.runId === 'string'
          ? { type: value.type, userId: value.userId, runId: value.runId }
          : null;
      case 'pipeline.completed':
        return typeof value.runId === 'string' &&
          (value.status === 'completed' || value.status === 'failed')
          ? {
              type: value.type,
              userId: value.userId,
              runId: value.runId,
              status: value.status,
            }
          : null;
      case 'alert.created':
        return typeof value.alertId === 'string'
          ? { type: value.type, userId: value.userId, alertId: value.alertId }
          : null;
      case 'recommendation.created':
        return typeof value.recommendationId === 'string'
          ? {
              type: value.type,
              userId: value.userId,
              recommendationId: value.recommendationId,
            }
          : null;
      case 'pipeline.stage':
        return parseStage(value);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseStage(value: Record<string, unknown>): PipelineEvent | null {
  if (typeof value.userId !== 'string' || typeof value.runId !== 'string') {
    return null;
  }
  if (!isAgentName(value.agentName) || !isStageStatus(value.status)) {
    return null;
  }

  const summary = nullableString(value.summary);
  const done = nullableNumber(value.done);
  const total = nullableNumber(value.total);
  const kind = nullableKind(value.kind);
  if (
    summary === undefined ||
    done === undefined ||
    total === undefined ||
    kind === undefined
  ) {
    return null;
  }

  return {
    type: 'pipeline.stage',
    userId: value.userId,
    runId: value.runId,
    agentName: value.agentName,
    status: value.status,
    summary,
    done,
    total,
    kind,
  };
}

function isAgentName(value: unknown): value is AgentName {
  return typeof value === 'string' && AGENT_NAMES.has(value as AgentName);
}

function isStageStatus(value: unknown): value is PipelineStageStatus {
  return (
    typeof value === 'string' &&
    STAGE_STATUSES.has(value as PipelineStageStatus)
  );
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function nullableKind(value: unknown): PipelineProgressKind | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === 'supplier' || value === 'route') {
    return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
