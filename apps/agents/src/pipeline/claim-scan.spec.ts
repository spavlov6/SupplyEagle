import type { EntityManager } from 'typeorm';
import { claimScan } from './claim-scan.js';

const userId = '11111111-1111-1111-1111-111111111111';

describe('claimScan', () => {
  const manager = {
    query: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((_entity: unknown, value: unknown) => value),
    save: vi.fn(async (value: unknown) => {
      if (Array.isArray(value)) {
        return value;
      }
      return { id: 'run-1', ...(value as object) };
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the scan already queued for the account', async () => {
    const existing = {
      id: 'run-existing',
      userId,
      status: 'running',
      stages: [],
    };
    manager.findOne.mockResolvedValue(existing);

    const result = await claimScan(manager as unknown as EntityManager, userId);

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
      [`scan-${userId}`],
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(result).toEqual({ run: existing, created: false });
  });

  it('creates one run and its six stages when the account is idle', async () => {
    manager.findOne.mockResolvedValue(null);

    const result = await claimScan(manager as unknown as EntityManager, userId);

    expect(result.created).toBe(true);
    expect(result.run.id).toBe('run-1');
    expect(result.run.stages).toHaveLength(6);
  });
});
