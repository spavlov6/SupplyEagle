import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PipelineRun,
  PipelineRunListResponse,
  PipelineSchedule,
  PipelineStatusResponse,
} from '@supplyeagle/types';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';

export function usePipelineStatus() {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.pipeline.status(),
    enabled: Boolean(token),
    queryFn: () =>
      apiClient<PipelineStatusResponse>('/pipeline/status', { token }),
  });
}

export function usePipelineRuns() {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.pipeline.runs(),
    enabled: Boolean(token),
    queryFn: () =>
      apiClient<PipelineRunListResponse>('/pipeline/runs', { token }),
  });
}

export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient<PipelineRun>('/pipeline/runs', {
        method: 'POST',
        token: readAccessToken(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
  });
}

export function usePinLocalClock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (timezone: string) =>
      apiClient<PipelineSchedule>('/pipeline/clock', {
        method: 'PUT',
        body: { timezone },
        token: readAccessToken(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
    },
  });
}
