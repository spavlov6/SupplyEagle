import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Recommendation,
  RecommendationListResponse,
  RecommendationStatus,
} from '@supplyeagle/types';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';

export function useRecommendations(status: RecommendationStatus) {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.recommendations.list(status),
    enabled: Boolean(token),
    queryFn: () =>
      apiClient<RecommendationListResponse>(
        `/recommendations?status=${status}`,
        { token },
      ),
  });
}

export function useRecommendation(id: string | undefined) {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.recommendations.detail(id ?? ''),
    enabled: Boolean(token && id),
    queryFn: () =>
      apiClient<Recommendation>(`/recommendations/${id}`, { token }),
  });
}

export function useAcceptRecommendation() {
  return useRecommendationMutation((id) =>
    apiClient<Recommendation>(`/recommendations/${id}/accept`, {
      method: 'POST',
      token: readAccessToken(),
    }),
  );
}

export function useDismissRecommendation() {
  return useRecommendationMutation((id) =>
    apiClient<Recommendation>(`/recommendations/${id}/dismiss`, {
      method: 'POST',
      token: readAccessToken(),
    }),
  );
}

function useRecommendationMutation(
  send: (id: string) => Promise<Recommendation>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.all,
      });
    },
  });
}
