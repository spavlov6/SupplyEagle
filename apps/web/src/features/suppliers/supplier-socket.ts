import type {
  AlertCreatedMessage,
  AnalysisUpdatedMessage,
  PipelineCompletedMessage,
  PipelineStageMessage,
  PipelineStartedMessage,
  RecommendationCreatedMessage,
  RouteAssessmentUpdatedMessage,
} from '@supplyeagle/types';
import { io, type Socket } from 'socket.io-client';

export type RealtimeSocket = Socket<
  {
    'analysis.updated': (message: AnalysisUpdatedMessage) => void;
    'route.assessment.updated': (
      message: RouteAssessmentUpdatedMessage,
    ) => void;
    'pipeline.started': (message: PipelineStartedMessage) => void;
    'pipeline.stage': (message: PipelineStageMessage) => void;
    'pipeline.completed': (message: PipelineCompletedMessage) => void;
    'schedule.updated': () => void;
    'alert.created': (message: AlertCreatedMessage) => void;
    'recommendation.created': (message: RecommendationCreatedMessage) => void;
  },
  Record<string, never>
>;

type CachedSocket = {
  token: string;
  socket: RealtimeSocket;
  refs: number;
};

let cached: CachedSocket | null = null;

export function acquireRealtimeSocket(token: string): RealtimeSocket {
  if (cached?.token === token) {
    cached.refs += 1;
    return cached.socket;
  }

  if (cached) {
    cached.socket.disconnect();
    cached = null;
  }

  const socket = openSocket(token);
  cached = { token, socket, refs: 1 };
  return socket;
}

export function releaseRealtimeSocket(token: string): void {
  if (!cached || cached.token !== token) {
    return;
  }

  cached.refs -= 1;
  if (cached.refs > 0) {
    return;
  }

  cached.socket.disconnect();
  cached = null;
}

function openSocket(token: string): RealtimeSocket {
  const options = {
    path: '/socket.io',
    auth: { token },
  };
  const origin = socketOrigin();
  return origin ? io(origin, options) : io(options);
}

function socketOrigin(): string | undefined {
  const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    return new URL(apiUrl).origin;
  }

  return undefined;
}
