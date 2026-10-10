import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSupplierRequest,
  Supplier,
  SupplierDetailResponse,
  SupplierListResponse,
} from '@supplyeagle/types';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';

export function useSuppliersQuery() {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.suppliers.list(),
    enabled: Boolean(token),
    queryFn: () => apiClient<SupplierListResponse>('/suppliers', { token }),
  });
}

export function useSupplierQuery(supplierId: string | undefined) {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.suppliers.detail(supplierId ?? ''),
    enabled: Boolean(token && supplierId),
    queryFn: () =>
      apiClient<SupplierDetailResponse>(`/suppliers/${supplierId}`, { token }),
  });
}

export function useReassessSupplierMutation(supplierId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient<SupplierDetailResponse>(`/suppliers/${supplierId}/reassess`, {
        method: 'POST',
        token: readAccessToken(),
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.suppliers.detail(supplierId), detail);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.suppliers.list(),
      });
    },
  });
}

export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateSupplierRequest) =>
      apiClient<Supplier>('/suppliers', {
        method: 'POST',
        body,
        token: readAccessToken(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}
