import type { AgentName } from '@supplyeagle/types';

export const AGENT_ORDER = [
  'monitoring',
  'anomaly_detector',
  'supply_risk',
  'supplier_finder',
  'decision',
  'execution',
] as const satisfies readonly AgentName[];

type MissingAgent = Exclude<AgentName, (typeof AGENT_ORDER)[number]>;
const agentsCovered: MissingAgent extends never ? true : never = true;
void agentsCovered;

export function agentLabel(name: AgentName): string {
  switch (name) {
    case 'monitoring':
      return 'Monitoring';
    case 'anomaly_detector':
      return 'Anomaly Detector';
    case 'supply_risk':
      return 'Supply Risk';
    case 'supplier_finder':
      return 'Supplier Finder';
    case 'decision':
      return 'Decision';
    case 'execution':
      return 'Execution';
    default: {
      const unexpected: never = name;
      return unexpected;
    }
  }
}

export function scanPattern(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`;
}

export function schedulerId(userId: string): string {
  return `scan-${userId}`;
}

export function runJobId(runId: string): string {
  return `run-${runId}`;
}
