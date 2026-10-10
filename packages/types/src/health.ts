export type HealthStatus = 'ok' | 'degraded' | 'error';

export type HealthServiceName = 'api' | 'agents';

export type HealthResponse = {
  status: HealthStatus;
  service: HealthServiceName;
  timestamp: string;
};
