import type { AgentName } from '@supplyeagle/types';

export const AGENT_ORDER = [
  'monitoring',
  'anomaly_detector',
  'supply_risk',
  'supplier_finder',
  'decision',
  'execution',
] as const satisfies readonly AgentName[];

export const DEFAULT_SCAN_HOUR = 8;
export const DEFAULT_SCAN_MINUTE = 30;
export const DEFAULT_SCAN_TIMEZONE = 'UTC';
