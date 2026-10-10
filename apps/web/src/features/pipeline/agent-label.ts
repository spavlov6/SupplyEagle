import type { AgentName } from '@supplyeagle/types';

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

export const AGENT_ORDER = [
  'monitoring',
  'anomaly_detector',
  'supply_risk',
  'supplier_finder',
  'decision',
  'execution',
] as const satisfies readonly AgentName[];

export function firstSentences(text: string, count: number): string {
  const trimmed = text.trim();
  const parts = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!parts) {
    return trimmed;
  }
  return parts
    .slice(0, count)
    .map((part) => part.trim())
    .join(' ');
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatCountdown(iso: string, now: number): string | null {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) {
    return null;
  }

  const remaining = target - now;
  if (remaining <= 0) {
    return null;
  }

  const total = Math.floor(remaining / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  return `${minutes}m ${pad(seconds)}s`;
}
