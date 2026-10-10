import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';
import { connectSupplierSocket } from './supplier-socket';

export function useSupplierRealtime(): void {
  const queryClient = useQueryClient();
  const token = readAccessToken();

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = connectSupplierSocket(token);
    const onUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    };
    socket.on('analysis.updated', onUpdated);

    return () => {
      socket.off('analysis.updated', onUpdated);
      socket.disconnect();
    };
  }, [queryClient, token]);
}
