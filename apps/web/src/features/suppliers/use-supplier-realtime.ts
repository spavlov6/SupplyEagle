import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';
import { acquireRealtimeSocket, releaseRealtimeSocket } from './supplier-socket';

export function useSupplierRealtime(): void {
  const queryClient = useQueryClient();
  const token = readAccessToken();

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = acquireRealtimeSocket(token);
    const onSuppliers = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    };
    const onRoutes = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.routes.all });
    };
    socket.on('analysis.updated', onSuppliers);
    socket.on('route.assessment.updated', onRoutes);

    return () => {
      socket.off('analysis.updated', onSuppliers);
      socket.off('route.assessment.updated', onRoutes);
      releaseRealtimeSocket(token);
    };
  }, [queryClient, token]);
}
