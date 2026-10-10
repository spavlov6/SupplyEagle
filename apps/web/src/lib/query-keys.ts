export const queryKeys = {
  health: {
    all: ['health'] as const,
    api: () => [...queryKeys.health.all, 'api'] as const,
  },
};
