import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RouteRedisService } from '../realtime/route-redis.service.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { Route } from './route.entity.js';
import { RouteAssessment } from './route-assessment.entity.js';
import { RouteSourceCheck } from './route-source-check.entity.js';
import { RouteSupplier } from './route-supplier.entity.js';
import { RoutesService } from './routes.service.js';

const userId = '11111111-1111-4111-8111-111111111111';
const routeId = '22222222-2222-4222-8222-222222222222';
const analysisId = '33333333-3333-4333-8333-333333333333';
const supplierId = '44444444-4444-4444-8444-444444444444';
const otherSupplierId = '55555555-5555-4555-8555-555555555555';
const createdAt = new Date('2026-10-10T12:00:00.000Z');

describe('RoutesService', () => {
  const routes = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value: Partial<Route>) => value),
    save: vi.fn(),
  };
  const links = {
    create: vi.fn((value: Partial<RouteSupplier>) => value),
    save: vi.fn(),
  };
  const assessments = {
    create: vi.fn((value: Partial<RouteAssessment>) => value),
    save: vi.fn(),
    update: vi.fn(),
  };
  const sourceChecks = {
    create: vi.fn((value: Partial<RouteSourceCheck>) => value),
    save: vi.fn(),
    update: vi.fn(),
  };
  const suppliers = {
    find: vi.fn(),
  };
  const events = {
    publish: vi.fn(),
  };

  let service: RoutesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    routes.save.mockImplementation(async (value: Partial<Route>) => ({
      id: routeId,
      createdAt,
      updatedAt: createdAt,
      links: [],
      ...value,
    }));
    assessments.save.mockImplementation(
      async (value: Partial<RouteAssessment>) => ({
        id: analysisId,
        createdAt,
        updatedAt: createdAt,
        ...value,
      }),
    );
    links.save.mockImplementation(async (value: unknown) => value);
    sourceChecks.save.mockImplementation(async (value: unknown) => value);
    events.publish.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RoutesService,
        { provide: getRepositoryToken(Route), useValue: routes },
        { provide: getRepositoryToken(RouteSupplier), useValue: links },
        { provide: getRepositoryToken(RouteAssessment), useValue: assessments },
        {
          provide: getRepositoryToken(RouteSourceCheck),
          useValue: sourceChecks,
        },
        { provide: getRepositoryToken(Supplier), useValue: suppliers },
        { provide: RouteRedisService, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(RoutesService);
  });

  it('creates a queued assessment and publishes route.created', async () => {
    suppliers.find.mockResolvedValue([
      { id: supplierId, userId, name: 'Nordwind' },
    ]);

    const result = await service.create(userId, {
      origin: 'Shanghai',
      destination: 'Rotterdam',
      mode: 'sea',
      supplierIds: [supplierId],
    });

    expect(suppliers.find).toHaveBeenCalledTimes(1);
    const lookup = suppliers.find.mock.calls[0]?.[0] as {
      where: { userId: string; id: { value: string[] } };
    };
    expect(lookup.where.userId).toBe(userId);
    expect(lookup.where.id.value).toEqual([supplierId]);
    expect(routes.create).toHaveBeenCalledWith({
      userId,
      origin: 'Shanghai',
      destination: 'Rotterdam',
      mode: 'sea',
    });
    expect(links.save).toHaveBeenCalledWith([
      expect.objectContaining({ routeId, supplierId }),
    ]);
    expect(assessments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId,
        userId,
        status: 'queued',
        riskState: null,
        laneStatus: null,
      }),
    );
    expect(sourceChecks.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          analysisId,
          source: 'google_news',
          status: 'pending',
        }),
        expect.objectContaining({
          analysisId,
          source: 'met_norway',
          status: 'pending',
        }),
        expect.objectContaining({
          analysisId,
          source: 'supplier_propagation',
          status: 'pending',
        }),
      ]),
    );
    expect(events.publish).toHaveBeenCalledWith({
      type: 'route.created',
      userId,
      routeId,
    });
    expect(result).toEqual({
      id: routeId,
      origin: 'Shanghai',
      destination: 'Rotterdam',
      mode: 'sea',
      createdAt: '2026-10-10T12:00:00.000Z',
      analysisStatus: 'queued',
      laneStatus: null,
      riskState: null,
      supplierCount: 1,
      transitDays: null,
      why: null,
    });
  });

  it("rejects a supplier id that is not the current user's", async () => {
    suppliers.find.mockResolvedValue([
      { id: supplierId, userId, name: 'Nordwind' },
    ]);

    await expect(
      service.create(userId, {
        origin: 'Shanghai',
        destination: 'Rotterdam',
        mode: 'air',
        supplierIds: [supplierId, otherSupplierId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(routes.save).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});
