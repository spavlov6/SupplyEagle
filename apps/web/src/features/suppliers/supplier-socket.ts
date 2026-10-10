import type { AnalysisUpdatedMessage } from '@supplyeagle/types';
import { io, type Socket } from 'socket.io-client';

export type SupplierSocket = Socket<
  { 'analysis.updated': (message: AnalysisUpdatedMessage) => void },
  Record<string, never>
>;

export function connectSupplierSocket(token: string): SupplierSocket {
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
