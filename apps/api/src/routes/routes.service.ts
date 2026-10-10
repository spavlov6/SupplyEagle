import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  RouteAssessment as RouteAssessmentResponse,
  RouteDetailResponse,
  RouteLinkedSupplier,
  RouteListItem,
  RouteListResponse,
  RouteSourceCategory,
  RouteSourceCheck as RouteSourceCheckResponse,
  RouteSourceName,
} from '@supplyeagle/types';
import { In, Repository } from 'typeorm';
import { RouteRedisService } from '../realtime/route-redis.service.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import type { SupplierAnalysis as SupplierAnalysisEntity } from '../suppliers/supplier-analysis.entity.js';
import type { CreateRouteDto } from './dto/create-route.dto.js';
import { Route } from './route.entity.js';
import { RouteAssessment } from './route-assessment.entity.js';
import { RouteSourceCheck } from './route-source-check.entity.js';
import { RouteSupplier } from './route-supplier.entity.js';

const ROUTE_SOURCES = [
  'google_news',
  'reliefweb',
  'open_meteo',
  'met_norway',
  'gdacs',
  'eonet',
  'usgs',
  'supplier_propagation',
] as const satisfies readonly RouteSourceName[];

type CoveredSource = (typeof ROUTE_SOURCES)[number];
type MissingSource = Exclude<RouteSourceName, CoveredSource>;
type SourcesComplete = [MissingSource] extends [never] ? true : never;
const sourcesComplete: SourcesComplete = true;
void sourcesComplete;

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(RouteSupplier)
    private readonly links: Repository<RouteSupplier>,
    @InjectRepository(RouteAssessment)
    private readonly assessments: Repository<RouteAssessment>,
    @InjectRepository(RouteSourceCheck)
    private readonly sourceChecks: Repository<RouteSourceCheck>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    private readonly events: RouteRedisService,
  ) {}

  async list(userId: string): Promise<RouteListResponse> {
    const rows = await this.routes.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { assessments: true, links: true },
    });

    return {
      routes: rows.map((row) =>
        this.toListItem(row, latestAssessment(row.assessments)),
      ),
    };
  }

  async get(userId: string, id: string): Promise<RouteDetailResponse> {
    const row = await this.findOwned(userId, id);
    const assessment = latestAssessment(row.assessments);
    return {
      route: this.toDetail(row),
      assessment: assessment ? this.toAssessment(assessment) : null,
    };
  }

  async reassess(userId: string, id: string): Promise<RouteDetailResponse> {
    const row = await this.findOwned(userId, id);
    const assessment = await this.queueAssessment(userId, row);
    try {
      await this.events.publish({
        type: 'route.reassess',
        userId,
        routeId: row.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish route.reassess for ${row.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      route: this.toDetail(row),
      assessment: this.toAssessment(assessment),
    };
  }

  async create(userId: string, dto: CreateRouteDto): Promise<RouteListItem> {
    if (dto.supplierIds.length === 0) {
      throw new BadRequestException('Select at least one supplier.');
    }

    const owned = await this.suppliers.find({
      where: { userId, id: In(dto.supplierIds) },
    });
    if (owned.length !== dto.supplierIds.length) {
      throw new BadRequestException('Select suppliers from your account.');
    }

    const ownedIds = new Set(owned.map((supplier) => supplier.id));
    const supplierIds = dto.supplierIds.filter((id) => ownedIds.has(id));
    const saved = await this.routes.save(
      this.routes.create({
        userId,
        origin: dto.origin,
        destination: dto.destination,
        mode: dto.mode,
      }),
    );
    await this.links.save(
      supplierIds.map((supplierId) =>
        this.links.create({
          routeId: saved.id,
          supplierId,
        }),
      ),
    );
    const assessment = await this.assessments.save(
      this.assessments.create({
        routeId: saved.id,
        userId,
        status: 'queued',
        riskState: null,
        laneStatus: null,
        transitDays: null,
        why: null,
        summary: null,
        error: null,
      }),
    );
    await this.pendingChecks(assessment.id);

    try {
      await this.events.publish({
        type: 'route.created',
        userId,
        routeId: saved.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish route.created for ${saved.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return this.toListItem(saved, assessment, supplierIds.length);
  }

  private async findOwned(userId: string, id: string): Promise<Route> {
    const row = await this.routes.findOne({
      where: { id, userId },
      relations: {
        assessments: { sources: true },
        links: { supplier: { analyses: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Route not found');
    }

    return row;
  }

  private async queueAssessment(
    userId: string,
    row: Route,
  ): Promise<RouteAssessment> {
    const current = latestAssessment(row.assessments);
    if (current?.status === 'queued' || current?.status === 'running') {
      throw new ConflictException('This route is already being checked');
    }

    if (!current) {
      const created = await this.assessments.save(
        this.assessments.create({
          routeId: row.id,
          userId,
          status: 'queued',
          riskState: null,
          laneStatus: null,
          transitDays: null,
          why: null,
          summary: null,
          error: null,
        }),
      );
      created.sources = await this.pendingChecks(created.id);
      return created;
    }

    const assessedAt = new Date();
    await this.assessments.update(current.id, {
      status: 'queued',
      riskState: null,
      laneStatus: null,
      transitDays: null,
      why: null,
      summary: null,
      error: null,
      updatedAt: assessedAt,
    });
    current.updatedAt = assessedAt;
    current.status = 'queued';
    current.riskState = null;
    current.laneStatus = null;
    current.transitDays = null;
    current.why = null;
    current.summary = null;
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

  private async pendingChecks(analysisId: string): Promise<RouteSourceCheck[]> {
    return this.sourceChecks.save(
      ROUTE_SOURCES.map((source) =>
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

  private toListItem(
    row: Route,
    assessment: RouteAssessment | undefined,
    supplierCount = row.links?.length ?? 0,
  ): RouteListItem {
    return {
      id: row.id,
      origin: row.origin,
      destination: row.destination,
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      assessedAt: assessedAt(assessment),
      analysisStatus: assessment?.status ?? null,
      laneStatus: assessment?.laneStatus ?? null,
      riskState: assessment?.riskState ?? null,
      supplierCount,
      transitDays: assessment?.transitDays ?? null,
      why: assessment?.why ?? null,
    };
  }

  private toDetail(row: Route): RouteDetailResponse['route'] {
    return {
      id: row.id,
      origin: row.origin,
      destination: row.destination,
      mode: row.mode,
      createdAt: row.createdAt.toISOString(),
      suppliers: linkedSuppliers(row.links ?? []),
    };
  }

  private toAssessment(assessment: RouteAssessment): RouteAssessmentResponse {
    const sources = [...(assessment.sources ?? [])]
      .filter((source) => isActiveSource(source.source))
      .sort(
        (left, right) => sourceOrder(left.source) - sourceOrder(right.source),
      );

    return {
      id: assessment.id,
      status: assessment.status,
      riskState: assessment.riskState,
      laneStatus: assessment.laneStatus,
      transitDays: assessment.transitDays,
      why: assessment.why,
      summary: assessment.summary,
      error: assessment.error,
      sources: sources.map((source) => this.toSource(source)),
    };
  }

  private toSource(source: RouteSourceCheck): RouteSourceCheckResponse {
    return {
      source: source.source,
      status: source.status,
      label: source.label,
      url: source.url,
      category: source.facts?.category ?? categoryForSource(source.source),
      agreement: source.facts?.agreement ?? null,
      hazard: source.facts?.hazard ?? null,
      place: source.facts?.place ?? null,
      detail: source.facts?.detail ?? null,
      error: source.error,
      items: source.facts?.items ?? [],
    };
  }
}

function linkedSuppliers(links: RouteSupplier[]): RouteLinkedSupplier[] {
  return links
    .flatMap((link) => {
      if (!link.supplier) {
        return [];
      }

      const analysis = latestSupplierAnalysis(link.supplier.analyses);
      return [
        {
          id: link.supplier.id,
          name: link.supplier.name,
          confidence: analysis?.confidence ?? null,
          sanctionsHit: analysis?.sanctionsHit ?? null,
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function assessedAt(assessment: RouteAssessment | undefined): string | null {
  const stamp = assessment?.updatedAt ?? assessment?.createdAt;
  return stamp ? stamp.toISOString() : null;
}

function latestAssessment(
  assessments: RouteAssessment[] | undefined,
): RouteAssessment | undefined {
  if (!assessments || assessments.length === 0) {
    return undefined;
  }

  return assessments.reduce((latest, current) =>
    current.createdAt.getTime() > latest.createdAt.getTime() ? current : latest,
  );
}

function latestSupplierAnalysis(
  analyses: SupplierAnalysisEntity[] | undefined,
): SupplierAnalysisEntity | undefined {
  if (!analyses || analyses.length === 0) {
    return undefined;
  }

  return analyses.reduce((latest, current) =>
    current.createdAt.getTime() > latest.createdAt.getTime() ? current : latest,
  );
}

function isActiveSource(source: string): source is RouteSourceName {
  return (ROUTE_SOURCES as readonly string[]).includes(source);
}

function categoryForSource(source: RouteSourceName): RouteSourceCategory {
  switch (source) {
    case 'google_news':
    case 'reliefweb':
      return 'news';
    case 'open_meteo':
    case 'met_norway':
      return 'weather';
    case 'gdacs':
    case 'eonet':
    case 'usgs':
      return 'disaster';
    case 'supplier_propagation':
      return 'supplier';
    default: {
      const unexpected: never = source;
      return unexpected;
    }
  }
}

function sourceOrder(source: RouteSourceName): number {
  switch (source) {
    case 'google_news':
      return 1;
    case 'reliefweb':
      return 2;
    case 'open_meteo':
      return 3;
    case 'met_norway':
      return 4;
    case 'gdacs':
      return 5;
    case 'eonet':
      return 6;
    case 'usgs':
      return 7;
    case 'supplier_propagation':
      return 8;
    default: {
      const unexpected: never = source;
      return unexpected;
    }
  }
}
