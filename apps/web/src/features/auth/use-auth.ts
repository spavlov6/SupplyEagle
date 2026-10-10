import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from '@supplyeagle/types';
import { useNavigate } from 'react-router';
import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import {
  clearAccessToken,
  readAccessToken,
  saveAccessToken,
} from './access-token';

export function useCurrentUserQuery() {
  const token = readAccessToken();

  return useQuery({
    queryKey: queryKeys.auth.me(),
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<AuthUser> => {
      try {
        return await apiClient<AuthUser>('/auth/me', { token });
      } catch (error) {
        clearAccessToken();
        throw error;
      }
    },
  });
}

export function useSignInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: LoginRequest) =>
      apiClient<AuthResponse>('/auth/login', { method: 'POST', body }),
    onSuccess: (data) => {
      saveAccessToken(data.accessToken);
      queryClient.setQueryData(queryKeys.auth.me(), data.user);
    },
  });
}

export function useSignUpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterRequest) =>
      apiClient<AuthResponse>('/auth/register', { method: 'POST', body }),
    onSuccess: (data) => {
      saveAccessToken(data.accessToken);
      queryClient.setQueryData(queryKeys.auth.me(), data.user);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return () => {
    clearAccessToken();
    queryClient.removeQueries({ queryKey: queryKeys.auth.all });
    void navigate('/sign-in');
  };
}
