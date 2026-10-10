import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@supplyeagle/types';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health.api(),
    queryFn: () => apiClient<HealthResponse>('/health'),
  });
}
