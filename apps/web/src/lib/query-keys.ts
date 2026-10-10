export const queryKeys = {
  health: {
    all: ['health'] as const,
    api: () => [...queryKeys.health.all, 'api'] as const,
  },
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
};
