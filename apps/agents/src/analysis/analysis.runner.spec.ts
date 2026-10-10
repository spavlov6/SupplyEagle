import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClaudeService } from './claude.service.js';
import { AnalysisRunner } from './analysis.runner.js';
import { Supplier } from './entities/supplier.entity.js';
import { SupplierAnalysis } from './entities/supplier-analysis.entity.js';
import { SupplierSourceCheck } from './entities/supplier-source-check.entity.js';
import { RedisService } from './redis.service.js';
import { SourceClient } from './source.client.js';
import type { SourceResult } from './source-result.js';

const supplierId = '22222222-2222-2222-2222-222222222222';
const userId = '11111111-1111-1111-1111-111111111111';
const analysisId = '33333333-3333-3333-3333-333333333333';

function found(legalName: string, country: string): SourceResult {
  return {
    status: 'found',
    label: legalName,
    url: 'https://example.test/record',
    facts: {
      legalName,
      country,
      sanctionsHit: null,
      matched: true,
    },
    error: null,
  };
}

describe('AnalysisRunner', () => {
  const analyses = {
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const checks = {
    find: vi.fn(),
    update: vi.fn(),
  };
  const suppliers = {
    update: vi.fn(),
  };
  const sources = {
    fetch: vi.fn(),
  };
  const claude = {
    summarize: vi.fn(),
  };
  const redis = {
    publish: vi.fn(),
  };

  let runner: AnalysisRunner;

  beforeEach(async () => {
    vi.clearAllMocks();
    analyses.update.mockResolvedValue(undefined);
    checks.update.mockResolvedValue(undefined);
    suppliers.update.mockResolvedValue(undefined);
    redis.publish.mockResolvedValue(undefined);
    analyses.findOne.mockResolvedValue({
      id: analysisId,
      supplierId,
      userId,
      status: 'queued',
      supplier: {
        id: supplierId,
        name: 'Siemens AG',
        country: null,
      },
    });
    checks.find.mockResolvedValue([
      { id: 's1', analysisId, source: 'opensanctions', status: 'pending' },
      { id: 's2', analysisId, source: 'gleif', status: 'pending' },
      { id: 's3', analysisId, source: 'wikidata', status: 'pending' },
    ]);
    sources.fetch.mockImplementation(async (source: string) => {
      switch (source) {
        case 'opensanctions':
          return {
            status: 'not_found',
            label: null,
            url: null,
            facts: {
              legalName: null,
              country: null,
              sanctionsHit: false,
              matched: false,
            },
            error: null,
          } satisfies SourceResult;
        case 'gleif':
          return found('Siemens Aktiengesellschaft', 'DE');
        case 'wikidata':
          return found('Siemens', 'Germany');
        default:
          throw new Error(`Unexpected source ${source}`);
      }
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalysisRunner,
        { provide: getRepositoryToken(SupplierAnalysis), useValue: analyses },
        { provide: getRepositoryToken(SupplierSourceCheck), useValue: checks },
        { provide: getRepositoryToken(Supplier), useValue: suppliers },
        { provide: SourceClient, useValue: sources },
        { provide: ClaudeService, useValue: claude },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    runner = moduleRef.get(AnalysisRunner);
  });

  it('stores a Claude summary when the sources agree', async () => {
    claude.summarize.mockResolvedValue(
      'GLEIF and Wikidata both place Siemens in Germany.',
    );

    await runner.run(supplierId);

    expect(sources.fetch).toHaveBeenCalledTimes(3);
    expect(claude.summarize).toHaveBeenCalledWith(
      expect.objectContaining({ supplierName: 'Siemens AG' }),
    );
    expect(suppliers.update).toHaveBeenCalledWith(supplierId, {
      country: 'Germany',
    });
    expect(analyses.update).toHaveBeenLastCalledWith(analysisId, {
      status: 'completed',
      confidence: 'verified',
      summary: 'GLEIF and Wikidata both place Siemens in Germany.',
      legalName: 'Siemens Aktiengesellschaft',
      country: 'Germany',
      sanctionsHit: false,
      factsHash: expect.any(String),
      error: null,
      updatedAt: expect.any(Date),
    });
    expect(redis.publish).toHaveBeenCalledWith({
      type: 'analysis.updated',
      userId,
      supplierId,
    });
  });

  it('keeps the source results when Claude fails', async () => {
    claude.summarize.mockRejectedValue(new Error('Claude unavailable'));

    await runner.run(supplierId);

    expect(checks.update).toHaveBeenCalledTimes(3);
    expect(suppliers.update).toHaveBeenCalledWith(supplierId, {
      country: 'Germany',
    });
    expect(analyses.update).toHaveBeenLastCalledWith(analysisId, {
      status: 'failed',
      confidence: 'verified',
      summary: null,
      legalName: 'Siemens Aktiengesellschaft',
      country: 'Germany',
      sanctionsHit: false,
      factsHash: expect.any(String),
      error: 'Claude unavailable',
      updatedAt: expect.any(Date),
    });
  });

  it('skips Claude when the collected facts are unchanged', async () => {
    let stored: string | undefined;
    analyses.update.mockImplementation(
      async (_id: string, patch: { factsHash?: string }) => {
        if (typeof patch.factsHash === 'string') {
          stored = patch.factsHash;
        }
      },
    );
    claude.summarize.mockResolvedValue(
      'GLEIF and Wikidata both place Siemens in Germany.',
    );
    await runner.run(supplierId);
    expect(claude.summarize).toHaveBeenCalledTimes(1);

    analyses.findOne.mockResolvedValue({
      id: analysisId,
      supplierId,
      userId,
      status: 'queued',
      summary: 'GLEIF and Wikidata both place Siemens in Germany.',
      factsHash: stored,
      supplier: {
        id: supplierId,
        name: 'Siemens AG',
        country: null,
      },
    });
    claude.summarize.mockClear();

    await runner.run(supplierId);

    expect(claude.summarize).not.toHaveBeenCalled();
    expect(analyses.update).toHaveBeenLastCalledWith(
      analysisId,
      expect.objectContaining({
        status: 'completed',
        summary: 'GLEIF and Wikidata both place Siemens in Germany.',
        factsHash: stored,
      }),
    );
  });
});
