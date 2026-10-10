import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  SourceName,
  Supplier as SupplierResponse,
  SupplierAnalysis as SupplierAnalysisResponse,
  SupplierDetailResponse,
  SupplierListResponse,
  SupplierSourceCheck as SupplierSourceCheckResponse,
} from '@supplyeagle/types';
import { Repository } from 'typeorm';
import { RedisService } from '../realtime/redis.service.js';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { Supplier } from './supplier.entity.js';
import { SupplierAnalysis } from './supplier-analysis.entity.js';
import { SupplierSourceCheck } from './supplier-source-check.entity.js';

const SUPPLIER_SOURCES: readonly SourceName[] = [
  'opensanctions',
  'gleif',
  'wikidata',
];

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(SupplierAnalysis)
    private readonly analyses: Repository<SupplierAnalysis>,
    @InjectRepository(SupplierSourceCheck)
    private readonly sourceChecks: Repository<SupplierSourceCheck>,
    private readonly events: RedisService,
  ) {}

  async list(userId: string): Promise<SupplierListResponse> {
    const rows = await this.suppliers.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { analyses: true },
    });

    return {
      suppliers: rows.map((row) =>
        this.toResponse(row, latestAnalysis(row.analyses)),
      ),
    };
  }

  async get(userId: string, id: string): Promise<SupplierDetailResponse> {
    const row = await this.suppliers.findOne({
      where: { id, userId },
      relations: { analyses: { sources: true } },
    });

    if (!row) {
      throw new NotFoundException('Supplier not found');
    }

    const analysis = latestAnalysis(row.analyses);
    return {
      supplier: this.toResponse(row, analysis),
      analysis: analysis ? this.toAnalysis(analysis) : null,
    };
  }

  async reassess(userId: string, id: string): Promise<SupplierDetailResponse> {
    const row = await this.suppliers.findOne({
      where: { id, userId },
      relations: { analyses: { sources: true } },
    });

    if (!row) {
      throw new NotFoundException('Supplier not found');
    }

    const analysis = await this.queueAnalysis(userId, row);
    try {
      await this.events.publish({
        type: 'supplier.reassess',
        userId,
        supplierId: row.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish supplier.reassess for ${row.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      supplier: this.toResponse(row, analysis),
      analysis: this.toAnalysis(analysis),
    };
  }

  async create(
    userId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierResponse> {
    const saved = await this.suppliers.save(
      this.suppliers.create({
        userId,
        name: dto.name,
        country: null,
      }),
    );
    const analysis = await this.analyses.save(
      this.analyses.create({
        supplierId: saved.id,
        userId,
        status: 'queued',
        confidence: null,
        summary: null,
        legalName: null,
        country: null,
        sanctionsHit: null,
        error: null,
      }),
    );
    await this.sourceChecks.save(
      SUPPLIER_SOURCES.map((source) =>
        this.sourceChecks.create({
          analysisId: analysis.id,
          source,
          status: 'pending',
          label: null,
          url: null,
          facts: null,
          error: null,
        }),
      ),
    );

    try {
      await this.events.publish({
        type: 'supplier.created',
        userId,
        supplierId: saved.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish supplier.created for ${saved.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return this.toResponse(saved, analysis);
  }

  private async queueAnalysis(
    userId: string,
    row: Supplier,
  ): Promise<SupplierAnalysis> {
    const current = latestAnalysis(row.analyses);
    if (current?.status === 'queued' || current?.status === 'running') {
      throw new ConflictException('This supplier is already being checked');
    }

    if (!current) {
      const created = await this.analyses.save(
        this.analyses.create({
          supplierId: row.id,
          userId,
          status: 'queued',
          confidence: null,
          summary: null,
          legalName: null,
          country: null,
          sanctionsHit: null,
          error: null,
        }),
      );
      created.sources = await this.pendingChecks(created.id);
      return created;
    }

    const assessedAt = new Date();
    await this.analyses.update(current.id, {
      status: 'queued',
      confidence: null,
      legalName: null,
      country: null,
      sanctionsHit: null,
      error: null,
      updatedAt: assessedAt,
    });
    current.updatedAt = assessedAt;
    current.status = 'queued';
    current.confidence = null;
    current.legalName = null;
    current.country = null;
    current.sanctionsHit = null;
    current.error = null;

    const sources = current.sources ?? [];
    if (sources.length === 0) {
      current.sources = await this.pendingChecks(current.id);
      return current;
    }

    for (const source of sources) {
      await this.sourceChecks.update(source.id, {
        status: 'pending',
        label: null,
        url: null,
        facts: null,
        error: null,
      });
      source.status = 'pending';
      source.label = null;
      source.url = null;
      source.facts = null;
      source.error = null;
    }

    return current;
  }

  private async pendingChecks(
    analysisId: string,
  ): Promise<SupplierSourceCheck[]> {
    return this.sourceChecks.save(
      SUPPLIER_SOURCES.map((source) =>
        this.sourceChecks.create({
          analysisId,
          source,
          status: 'pending',
          label: null,
          url: null,
          facts: null,
          error: null,
        }),
      ),
    );
  }

  private toResponse(
    row: Supplier,
    analysis: SupplierAnalysis | undefined,
  ): SupplierResponse {
    return {
      id: row.id,
      name: row.name,
      country: analysis?.country ?? row.country ?? null,
      createdAt: row.createdAt.toISOString(),
      assessedAt: assessedAt(analysis),
      analysisStatus: analysis?.status ?? null,
      confidence: analysis?.confidence ?? null,
      sanctionsHit: analysis?.sanctionsHit ?? null,
    };
  }

  private toAnalysis(analysis: SupplierAnalysis): SupplierAnalysisResponse {
    const sources = [...(analysis.sources ?? [])].sort(
      (left, right) => sourceOrder(left.source) - sourceOrder(right.source),
    );

    return {
      id: analysis.id,
      status: analysis.status,
      confidence: analysis.confidence,
      summary: analysis.summary,
      legalName: analysis.legalName,
      country: analysis.country,
      sanctionsHit: analysis.sanctionsHit,
      error: analysis.error,
      sources: sources.map((source) => this.toSource(source)),
    };
  }

  private toSource(source: SupplierSourceCheck): SupplierSourceCheckResponse {
    return {
      source: source.source,
      status: source.status,
      label: source.label,
      url: source.url,
      country: source.facts?.country ?? null,
      sanctionsHit: source.facts?.sanctionsHit ?? null,
      lei: source.facts?.lei ?? null,
      city: source.facts?.city ?? null,
      address: source.facts?.address ?? null,
      registrationNumber: source.facts?.registrationNumber ?? null,
      founded: source.facts?.founded ?? null,
      entityStatus: source.facts?.entityStatus ?? null,
      website: source.facts?.website ?? null,
      description: source.facts?.description ?? null,
      error: source.error,
    };
  }
}

function assessedAt(analysis: SupplierAnalysis | undefined): string | null {
  const stamp = analysis?.updatedAt ?? analysis?.createdAt;
  return stamp ? stamp.toISOString() : null;
}

function latestAnalysis(
  analyses: SupplierAnalysis[] | undefined,
): SupplierAnalysis | undefined {
  if (!analyses || analyses.length === 0) {
    return undefined;
  }

  return analyses.reduce((latest, current) =>
    current.createdAt.getTime() > latest.createdAt.getTime() ? current : latest,
  );
}

function sourceOrder(source: SourceName): number {
  switch (source) {
    case 'opensanctions':
      return 0;
    case 'gleif':
      return 1;
    case 'wikidata':
      return 2;
    default: {
      const unexpected: never = source;
      return unexpected;
    }
  }
}
