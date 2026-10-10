export const queryKeys = {
  health: {
    all: ['health'] as const,
    api: () => [...queryKeys.health.all, 'api'] as const,
  },
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  suppliers: {
    all: ['suppliers'] as const,
    list: () => [...queryKeys.suppliers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.suppliers.all, 'detail', id] as const,
  },
  routes: {
    all: ['routes'] as const,
    list: () => [...queryKeys.routes.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.routes.all, 'detail', id] as const,
  },
  places: {
    all: ['places'] as const,
    lane: (origin: string, destination: string) =>
      [...queryKeys.places.all, 'country', origin, destination] as const,
  },
};
