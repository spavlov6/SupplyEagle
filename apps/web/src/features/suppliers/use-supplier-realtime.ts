import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../../lib/query-keys';
import { readAccessToken } from '../auth/access-token';
import {
  acquireRealtimeSocket,
  releaseRealtimeSocket,
} from './supplier-socket';

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
    const onPipeline = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview.all });
    };
    const onRecommendations = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.all,
      });
    };
    socket.on('analysis.updated', onSuppliers);
    socket.on('route.assessment.updated', onRoutes);
    socket.on('pipeline.started', onPipeline);
    socket.on('pipeline.stage', onPipeline);
    socket.on('pipeline.completed', onPipeline);
    socket.on('schedule.updated', onPipeline);
    socket.on('recommendation.created', onRecommendations);

    return () => {
      socket.off('analysis.updated', onSuppliers);
      socket.off('route.assessment.updated', onRoutes);
      socket.off('pipeline.started', onPipeline);
      socket.off('pipeline.stage', onPipeline);
      socket.off('pipeline.completed', onPipeline);
      socket.off('schedule.updated', onPipeline);
      socket.off('recommendation.created', onRecommendations);
      releaseRealtimeSocket(token);
    };
  }, [queryClient, token]);
}
