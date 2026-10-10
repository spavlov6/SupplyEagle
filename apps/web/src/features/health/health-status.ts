import type { HealthStatus } from '@supplyeagle/types';

export function healthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'ok':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'error':
      return 'Unhealthy';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
