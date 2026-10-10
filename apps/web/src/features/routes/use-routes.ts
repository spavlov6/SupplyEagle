import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRouteRequest,
  RouteDetailResponse,
  RouteListItem,
  RouteListResponse,
} from '@supplyeagle/types';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';

export function useRoutesQuery() {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.routes.list(),
    enabled: Boolean(token),
    queryFn: () => apiClient<RouteListResponse>('/routes', { token }),
  });
}

export function useRouteQuery(routeId: string | undefined) {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.routes.detail(routeId ?? ''),
    enabled: Boolean(token && routeId),
    queryFn: () => apiClient<RouteDetailResponse>(`/routes/${routeId}`, { token }),
  });
}

export function useCreateRouteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRouteRequest) =>
      apiClient<RouteListItem>('/routes', {
        method: 'POST',
        body,
        token: readAccessToken(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.routes.all });
    },
  });
}

export function useReassessRouteMutation(routeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient<RouteDetailResponse>(`/routes/${routeId}/reassess`, {
        method: 'POST',
        token: readAccessToken(),
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.routes.detail(routeId), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
    },
  });
}
