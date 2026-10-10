import { useQuery } from '@tanstack/react-query';
import type { OverviewResponse } from '@supplyeagle/types';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';

export function useOverview() {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.overview.home(),
    enabled: Boolean(token),
    queryFn: () => apiClient<OverviewResponse>('/overview', { token }),
  });
}
