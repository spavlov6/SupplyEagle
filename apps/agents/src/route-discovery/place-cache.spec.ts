import { describe, expect, it, vi } from 'vitest';
import { locateWithCache, type PlaceCacheStore } from './place-cache.js';

describe('locateWithCache', () => {
  it('returns a stored place without calling the geocoder', async () => {
    const locate = vi.fn();
    const cache: PlaceCacheStore = {
      findOne: async () => ({ lat: 53.5, lon: 10, country: 'Germany' }),
      save: async () => undefined,
    };

    const place = await locateWithCache('Hamburg', cache, locate);

    expect(locate).not.toHaveBeenCalled();
    expect(place).toEqual({
      name: 'Hamburg',
      lat: 53.5,
      lon: 10,
      country: 'Germany',
    });
  });

  it('stores a newly located place', async () => {
    const locate = vi.fn(async () => ({
      name: 'Rotterdam',
      lat: 51.9,
      lon: 4.5,
      country: 'Netherlands',
    }));
    const save = vi.fn(async () => undefined);
    const cache: PlaceCacheStore = {
      findOne: async () => null,
      save,
    };

    const place = await locateWithCache(' Rotterdam ', cache, locate);

    expect(locate).toHaveBeenCalledWith('Rotterdam');
    expect(save).toHaveBeenCalledWith({
      query: 'Rotterdam',
      lat: 51.9,
      lon: 4.5,
      country: 'Netherlands',
    });
    expect(place?.name).toBe('Rotterdam');
  });
});
