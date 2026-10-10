import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../realtime/redis.service.js';
import { Supplier } from './supplier.entity.js';
import { SupplierAnalysis } from './supplier-analysis.entity.js';
import { SupplierSourceCheck } from './supplier-source-check.entity.js';
import { SuppliersService } from './suppliers.service.js';

const userId = '11111111-1111-1111-1111-111111111111';
const supplierId = '22222222-2222-2222-2222-222222222222';
const analysisId = '33333333-3333-3333-3333-333333333333';
const createdAt = new Date('2026-10-10T12:00:00.000Z');
const assessedAt = new Date('2026-10-10T18:30:00.000Z');

describe('SuppliersService', () => {
  const suppliers = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value: Partial<Supplier>) => value),
    save: vi.fn(),
  };
  const analyses = {
    create: vi.fn((value: Partial<SupplierAnalysis>) => value),
    save: vi.fn(),
    update: vi.fn(),
  };
  const sourceChecks = {
    create: vi.fn((value: Partial<SupplierSourceCheck>) => value),
    save: vi.fn(),
    update: vi.fn(),
  };
  const events = {
    publish: vi.fn(),
  };

  let service: SuppliersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    suppliers.save.mockImplementation(async (value: Partial<Supplier>) => ({
      id: supplierId,
      createdAt,
      updatedAt: createdAt,
      ...value,
    }));
    analyses.save.mockImplementation(
      async (value: Partial<SupplierAnalysis>) => ({
        id: analysisId,
        createdAt,
        updatedAt: createdAt,
        ...value,
      }),
    );
    sourceChecks.save.mockImplementation(async (value: unknown) => value);
    analyses.update.mockResolvedValue(undefined);
    sourceChecks.update.mockResolvedValue(undefined);
    events.publish.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: getRepositoryToken(Supplier), useValue: suppliers },
        { provide: getRepositoryToken(SupplierAnalysis), useValue: analyses },
        {
          provide: getRepositoryToken(SupplierSourceCheck),
          useValue: sourceChecks,
        },
        { provide: RedisService, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(SuppliersService);
  });

  it("lists the caller's suppliers, newest first", async () => {
    suppliers.find.mockResolvedValue([
      {
        id: supplierId,
        userId,
        name: 'Nordwind Hydraulik GmbH',
        country: 'Germany',
        createdAt,
        analyses: [
          {
            status: 'completed',
            confidence: 'verified',
            sanctionsHit: false,
            createdAt,
            updatedAt: assessedAt,
          },
        ],
      },
    ]);

    const result = await service.list(userId);

    expect(suppliers.find).toHaveBeenCalledWith({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { analyses: true },
    });
    expect(result).toEqual({
      suppliers: [
        {
          id: supplierId,
          name: 'Nordwind Hydraulik GmbH',
          country: 'Germany',
          createdAt: '2026-10-10T12:00:00.000Z',
          assessedAt: '2026-10-10T18:30:00.000Z',
          analysisStatus: 'completed',
          confidence: 'verified',
          sanctionsHit: false,
        },
      ],
    });
  });

  it('creates a queued analysis and publishes supplier.created', async () => {
    const result = await service.create(userId, {
      name: 'Nordwind Hydraulik GmbH',
    });

    expect(suppliers.create).toHaveBeenCalledWith({
      userId,
      name: 'Nordwind Hydraulik GmbH',
      country: null,
    });
    expect(analyses.save).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId,
        userId,
        status: 'queued',
        confidence: null,
        sanctionsHit: null,
      }),
    );
    expect(sourceChecks.save).toHaveBeenCalledWith([
      expect.objectContaining({
        analysisId,
        source: 'opensanctions',
        status: 'pending',
      }),
      expect.objectContaining({
        analysisId,
        source: 'gleif',
        status: 'pending',
      }),
      expect.objectContaining({
        analysisId,
        source: 'wikidata',
        status: 'pending',
      }),
    ]);
    expect(events.publish).toHaveBeenCalledWith({
      type: 'supplier.created',
      userId,
      supplierId,
    });
    expect(result).toEqual({
      id: supplierId,
      name: 'Nordwind Hydraulik GmbH',
      country: null,
      createdAt: '2026-10-10T12:00:00.000Z',
      assessedAt: '2026-10-10T12:00:00.000Z',
      analysisStatus: 'queued',
      confidence: null,
      sanctionsHit: null,
    });
  });

  it('queues a fresh check when the supplier is reassessed', async () => {
    suppliers.findOne.mockResolvedValue({
      id: supplierId,
      userId,
      name: 'Siemens AG',
      country: 'Germany',
      createdAt,
      analyses: [
        {
          id: analysisId,
          status: 'failed',
          confidence: 'verified',
          summary: 'Previous summary',
          legalName: 'Siemens Aktiengesellschaft',
          country: 'Germany',
          sanctionsHit: false,
          error: 'model not found',
          createdAt,
          sources: [
            { id: 's1', source: 'opensanctions', status: 'error' },
            { id: 's2', source: 'gleif', status: 'found' },
            { id: 's3', source: 'wikidata', status: 'found' },
          ],
        },
      ],
    });

    const result = await service.reassess(userId, supplierId);

    expect(analyses.update).toHaveBeenCalledWith(analysisId, {
      status: 'queued',
      confidence: null,
      summary: null,
      legalName: null,
      country: null,
      sanctionsHit: null,
      error: null,
      updatedAt: expect.any(Date),
    });
    expect(sourceChecks.update).toHaveBeenCalledTimes(3);
    expect(events.publish).toHaveBeenCalledWith({
      type: 'supplier.reassess',
      userId,
      supplierId,
    });
    expect(result.analysis?.status).toBe('queued');
    expect(result.analysis?.sources.map((source) => source.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('rejects a reassess while a check is already running', async () => {
    suppliers.findOne.mockResolvedValue({
      id: supplierId,
      userId,
      name: 'Siemens AG',
      country: null,
      createdAt,
      analyses: [{ id: analysisId, status: 'running', createdAt, sources: [] }],
    });

    await expect(service.reassess(userId, supplierId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rejects a supplier that is not owned by the caller', async () => {
    suppliers.findOne.mockResolvedValue(null);

    await expect(service.get(userId, supplierId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(suppliers.findOne).toHaveBeenCalledWith({
      where: { id: supplierId, userId },
      relations: { analyses: { sources: true } },
    });
  });
});
