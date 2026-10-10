import type { ConnectionOptions } from 'bullmq';

export function bullConnection(redisUrl: string): ConnectionOptions {
  return {
    url: redisUrl,
    maxRetriesPerRequest: null,
  };
}

export function redisUrl(value: string | undefined): string {
  return value && value.length > 0 ? value : 'redis://localhost:6379';
}
