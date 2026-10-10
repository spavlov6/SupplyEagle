import type { RouteEvent } from '@supplyeagle/types';

export const ROUTE_EVENTS_CHANNEL = 'supplyeagle:route-events';

export function parseRouteEvent(message: string): RouteEvent | null {
  try {
    const value: unknown = JSON.parse(message);
    if (!isRecord(value)) {
      return null;
    }

    const type = value.type;
    const userId = value.userId;
    const routeId = value.routeId;
    if (
      (type === 'route.created' ||
        type === 'route.reassess' ||
        type === 'route.assessment.updated') &&
      typeof userId === 'string' &&
      typeof routeId === 'string'
    ) {
      return { type, userId, routeId };
    }
  } catch {
    return null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
