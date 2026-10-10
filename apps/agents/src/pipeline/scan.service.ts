import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type {
  AgentName,
  PipelineStageStatus,
  ScanBaseline,
  SourceName,
} from '@supplyeagle/types';
import { DataSource, Repository } from 'typeorm';
import { Supplier } from '../analysis/entities/supplier.entity.js';
import { SupplierAnalysis } from '../analysis/entities/supplier-analysis.entity.js';
import { SupplierSourceCheck } from '../analysis/entities/supplier-source-check.entity.js';
import { ROUTE_SOURCES } from '../route-discovery/categories.js';
import { Route } from '../route-discovery/entities/route.entity.js';
import { RouteAssessment } from '../route-discovery/entities/route-assessment.entity.js';
import { RouteSourceCheck } from '../route-discovery/entities/route-source-check.entity.js';
import { RefreshQueue } from '../refresh/refresh.queue.js';
import { agentLabel } from './agents.js';
import { claimScan } from './claim-scan.js';
import {
  accountSummary,
  detectAlerts,
  draftRecommendations,
  executionPlan,
  headlinesFromFacts,
  isActiveAlert,
  type OpenAlert,
} from './decide.js';
import { AlertRecord } from './entities/alert.entity.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineStageRecord } from './entities/pipeline-stage.entity.js';
import { RecommendationRecord } from './entities/recommendation.entity.js';
import { PipelineClaudeService } from './pipeline-claude.service.js';
import { PipelineRedisService } from './pipeline-redis.service.js';
import { ScanQueue } from './scan.queue.js';

const SUPPLIER_SOURCES: readonly SourceName[] = [
  'opensanctions',
  'gleif',
  'wikidata',
];

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PipelineRun)
    private readonly runs: Repository<PipelineRun>,
    @InjectRepository(PipelineStageRecord)
    private readonly stages: Repository<PipelineStageRecord>,
    @InjectRepository(AlertRecord)
    private readonly alerts: Repository<AlertRecord>,
    @InjectRepository(RecommendationRecord)
    private readonly recommendations: Repository<RecommendationRecord>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(SupplierAnalysis)
    private readonly analyses: Repository<SupplierAnalysis>,
    @InjectRepository(SupplierSourceCheck)
    private readonly supplierChecks: Repository<SupplierSourceCheck>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(RouteAssessment)
    private readonly assessments: Repository<RouteAssessment>,
    @InjectRepository(RouteSourceCheck)
    private readonly routeChecks: Repository<RouteSourceCheck>,
    private readonly refresh: RefreshQueue,
    private readonly queue: ScanQueue,
    private readonly claude: PipelineClaudeService,
    private readonly events: PipelineRedisService,
  ) {}

  async schedule(userId: string): Promise<void> {
    const claimed = await this.dataSource.transaction((manager) =>
      claimScan(manager, userId),
    );
    if (!claimed.created) {
      return;
    }

    await this.queue.addRun(userId, claimed.run.id);
  }

  async execute(runId: string): Promise<void> {
    const run = await this.runs.findOne({
      where: { id: runId },
      relations: { stages: true },
    });
    if (!run || run.status === 'completed' || run.status === 'failed') {
      return;
    }

    try {
      await this.runs.update(run.id, {
        status: 'running',
        startedAt: run.startedAt ?? new Date(),
      });
      run.status = 'running';
      await this.events.publish({
        type: 'pipeline.started',
        userId: run.userId,
        runId: run.id,
      });

      if (!this.finished(run, 'monitoring')) {
        await this.monitor(run);
      }
      if (!this.finished(run, 'anomaly_detector')) {
        await this.detect(run);
      }
      if (!this.finished(run, 'supply_risk')) {
        await this.summarize(run);
      }
      if (
        !this.finished(run, 'supplier_finder') ||
        !this.finished(run, 'decision')
      ) {
        await this.decide(run);
      }
      if (!this.finished(run, 'execution')) {
        await this.plan(run);
      }

      await this.runs.update(run.id, {
        status: 'completed',
        completedAt: new Date(),
      });
      await this.events.publish({
        type: 'pipeline.completed',
        userId: run.userId,
        runId: run.id,
        status: 'completed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed';
      this.logger.error(`Scan ${runId} failed: ${message}`);
      const current = run.stages?.find((stage) => stage.status === 'running');
      if (current) {
        await this.mark(
          run,
          current.agentName,
          'failed',
          current.summary,
          message,
        );
      }
      await this.runs.update(run.id, {
        status: 'failed',
        completedAt: new Date(),
      });
      await this.events.publish({
        type: 'pipeline.completed',
        userId: run.userId,
        runId: run.id,
        status: 'failed',
      });
    }
  }

  private finished(run: PipelineRun, name: AgentName): boolean {
    return (
      run.stages?.find((stage) => stage.agentName === name)?.status ===
      'completed'
    );
  }

  private async monitor(run: PipelineRun): Promise<void> {
    await this.mark(
      run,
      'monitoring',
      'running',
      'Checking suppliers and routes.',
    );
    if (!run.baseline) {
      run.baseline = await this.snapshot(run.userId);
      await this.runs.update(run.id, { baseline: run.baseline });
    }

    const suppliers = await this.suppliers.find({
      where: { userId: run.userId },
    });
    const routes = await this.routes.find({ where: { userId: run.userId } });
    let supplierFailures = 0;
    let routeFailures = 0;

    let suppliersDone = 0;
    await Promise.all(
      suppliers.map(async (supplier) => {
        try {
          await this.prepareSupplier(supplier);
          await this.refresh.addSupplier(supplier.id);
          await this.refresh.waitForSupplier(supplier.id);
          const analysis = await this.analyses.findOne({
            where: { supplierId: supplier.id },
            order: { updatedAt: 'DESC' },
          });
          if (analysis?.status === 'failed') {
            supplierFailures += 1;
          }
        } catch (error) {
          supplierFailures += 1;
          this.logger.error(this.failure('supplier', supplier.id, error));
        }
        suppliersDone += 1;
        await this.progress(
          run,
          suppliersDone,
          suppliers.length,
          'supplier',
          `${suppliersDone} of ${suppliers.length} suppliers`,
        );
      }),
    );

    let routesDone = 0;
    await Promise.all(
      routes.map(async (route) => {
        try {
          await this.prepareRoute(route);
          await this.refresh.addRoute(route.id);
          await this.refresh.waitForRoute(route.id);
          const assessment = await this.assessments.findOne({
            where: { routeId: route.id },
            order: { updatedAt: 'DESC' },
          });
          if (assessment?.status === 'failed') {
            routeFailures += 1;
          }
        } catch (error) {
          routeFailures += 1;
          this.logger.error(this.failure('route', route.id, error));
        }
        routesDone += 1;
        await this.progress(
          run,
          routesDone,
          routes.length,
          'route',
          `${routesDone} of ${routes.length} routes`,
        );
      }),
    );

    const failed = supplierFailures + routeFailures;
    const summary = `Checked ${countNoun(suppliers.length, 'supplier', 'suppliers')} and ${countNoun(routes.length, 'route', 'routes')}.${
      failed > 0 ? ` ${countNoun(failed, 'check', 'checks')} failed.` : ''
    }`;
    await this.mark(run, 'monitoring', 'completed', summary);
  }

  private async detect(run: PipelineRun): Promise<void> {
    await this.mark(run, 'anomaly_detector', 'running', null);
    if (!run.baseline) {
      await this.mark(
        run,
        'anomaly_detector',
        'completed',
        'No baseline was stored, so no alerts were opened.',
      );
      return;
    }

    const after = await this.snapshot(run.userId);
    const drafts = detectAlerts(run.baseline, after);
    let opened = 0;
    for (const draft of drafts) {
      const active = await this.alerts.find({
        where: { userId: run.userId, sourceKey: draft.sourceKey },
      });
      if (
        active.some(
          (alert) => isActiveAlert(alert.status) || alert.runId === run.id,
        )
      ) {
        continue;
      }

      const saved = await this.alerts.save(
        this.alerts.create({
          userId: run.userId,
          runId: run.id,
          status: 'open',
          recommendationId: null,
          ...draft,
        }),
      );
      opened += 1;
      await this.events.publish({
        type: 'alert.created',
        userId: run.userId,
        alertId: saved.id,
      });
    }

    await this.mark(
      run,
      'anomaly_detector',
      'completed',
      opened === 1 ? 'Opened 1 alert.' : `Opened ${opened} alerts.`,
    );
  }

  private async summarize(run: PipelineRun): Promise<void> {
    await this.mark(run, 'supply_risk', 'running', null);
    const current = await this.snapshot(run.userId);
    const counts = { critical: 0, elevated: 0, watch: 0, stable: 0 };
    for (const route of current.routes) {
      switch (route.riskState) {
        case 'critical':
        case 'elevated':
        case 'watch':
        case 'stable':
          counts[route.riskState] += 1;
          break;
        case null:
          break;
        default: {
          const unexpected: never = route.riskState;
          void unexpected;
        }
      }
    }
    const fallback = accountSummary({
      ...counts,
      sanctioned: current.suppliers.filter(
        (supplier) => supplier.sanctionsHit === true,
      ).length,
    });
    const summary = await this.claude.summary(
      {
        sanctionedSuppliers: current.suppliers.filter(
          (supplier) => supplier.sanctionsHit === true,
        ).length,
        routes: counts,
      },
      fallback,
    );
    await this.mark(run, 'supply_risk', 'completed', summary);
  }

  private async decide(run: PipelineRun): Promise<void> {
    const context = await this.loadContext(run);
    if (!this.finished(run, 'supplier_finder')) {
      await this.mark(run, 'supplier_finder', 'running', null);
      const preview = draftRecommendations(context);
      await this.mark(
        run,
        'supplier_finder',
        'completed',
        preview.finderSummary,
      );
    }

    if (this.finished(run, 'decision')) {
      return;
    }

    await this.mark(run, 'decision', 'running', null);
    const { drafts } = draftRecommendations(context);
    const phrased = await this.claude.recommendations(
      drafts.map((draft) => ({
        id: draft.alertId,
        title: draft.title,
        description: draft.description,
      })),
    );
    let written = 0;
    for (const draft of drafts) {
      const existing = await this.recommendations.findOne({
        where: { alertId: draft.alertId },
      });
      if (existing) {
        continue;
      }

      const copy = phrased.get(draft.alertId);
      const saved = await this.recommendations.save(
        this.recommendations.create({
          userId: run.userId,
          runId: run.id,
          alertId: draft.alertId,
          type: draft.type,
          priority: draft.priority,
          status: 'pending',
          title: copy?.title ?? draft.title,
          description: copy?.description ?? draft.description,
          supplierId: draft.supplierId,
          routeId: draft.routeId,
          alternativeSupplierId: draft.alternativeSupplierId,
          plan: null,
        }),
      );
      await this.alerts.update(draft.alertId, { recommendationId: saved.id });
      written += 1;
      await this.events.publish({
        type: 'recommendation.created',
        userId: run.userId,
        recommendationId: saved.id,
      });
    }

    await this.mark(
      run,
      'decision',
      'completed',
      written === 1
        ? 'Wrote 1 recommendation.'
        : `Wrote ${written} recommendations.`,
    );
  }

  private async plan(run: PipelineRun): Promise<void> {
    await this.mark(run, 'execution', 'running', null);
    const rows = await this.recommendations.find({ where: { runId: run.id } });
    let planned = 0;
    for (const row of rows) {
      if (row.priority < 3 || row.plan) {
        continue;
      }
      await this.recommendations.update(row.id, {
        plan: executionPlan(row.type),
      });
      planned += 1;
    }
    await this.mark(
      run,
      'execution',
      'completed',
      planned === 1
        ? 'Attached a plan to 1 recommendation.'
        : `Attached plans to ${planned} recommendations.`,
    );
  }

  private async loadContext(run: PipelineRun): Promise<{
    alerts: OpenAlert[];
    suppliers: Array<{
      id: string;
      name: string;
      confidence: SupplierAnalysis['confidence'];
      sanctionsHit: boolean | null;
      status: SupplierAnalysis['status'] | null;
    }>;
    routes: Array<{
      id: string;
      origin: string;
      destination: string;
      supplierIds: string[];
    }>;
  }> {
    const alerts = await this.alerts.find({ where: { runId: run.id } });
    const suppliers = await this.suppliers.find({
      where: { userId: run.userId },
    });
    const analyses = await this.analyses.find({
      where: { userId: run.userId },
      order: { updatedAt: 'DESC' },
    });
    const latest = new Map<string, SupplierAnalysis>();
    for (const analysis of analyses) {
      if (!latest.has(analysis.supplierId)) {
        latest.set(analysis.supplierId, analysis);
      }
    }
    const routes = await this.routes.find({
      where: { userId: run.userId },
      relations: { links: true },
    });

    return {
      alerts: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        supplierId: alert.supplierId,
        routeId: alert.routeId,
        sourceKey: alert.sourceKey,
      })),
      suppliers: suppliers.map((supplier) => {
        const analysis = latest.get(supplier.id);
        return {
          id: supplier.id,
          name: supplier.name,
          confidence: analysis?.confidence ?? null,
          sanctionsHit: analysis?.sanctionsHit ?? null,
          status: analysis?.status ?? null,
        };
      }),
      routes: routes.map((route) => ({
        id: route.id,
        origin: route.origin,
        destination: route.destination,
        supplierIds: (route.links ?? []).map((link) => link.supplierId),
      })),
    };
  }

  private async snapshot(userId: string): Promise<ScanBaseline> {
    const suppliers = await this.suppliers.find({ where: { userId } });
    const analyses = await this.analyses.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    const latestAnalysis = new Map<string, SupplierAnalysis>();
    for (const analysis of analyses) {
      if (!latestAnalysis.has(analysis.supplierId)) {
        latestAnalysis.set(analysis.supplierId, analysis);
      }
    }
    const routes = await this.routes.find({
      where: { userId },
      relations: { assessments: { sources: true } },
    });

    return {
      suppliers: suppliers.map((supplier) => {
        const analysis = latestAnalysis.get(supplier.id);
        return {
          id: supplier.id,
          name: supplier.name,
          sanctionsHit: analysis?.sanctionsHit ?? null,
          confidence: analysis?.confidence ?? null,
        };
      }),
      routes: routes.map((route) => {
        const assessment = latestByDate(route.assessments ?? []);
        return {
          id: route.id,
          origin: route.origin,
          destination: route.destination,
          riskState: assessment?.riskState ?? null,
          laneStatus: assessment?.laneStatus ?? null,
          headlines: (assessment?.sources ?? []).flatMap((source) =>
            headlinesFromFacts(source.facts),
          ),
        };
      }),
    };
  }

  private async prepareSupplier(supplier: Supplier): Promise<void> {
    const current = await this.analyses.findOne({
      where: { supplierId: supplier.id },
      order: { updatedAt: 'DESC' },
      relations: { sources: true },
    });
    if (current?.status === 'queued' || current?.status === 'running') {
      return;
    }
    if (!current) {
      const created = await this.analyses.save(
        this.analyses.create({
          supplierId: supplier.id,
          userId: supplier.userId,
          status: 'queued',
          confidence: null,
          summary: null,
          legalName: null,
          country: null,
          sanctionsHit: null,
          factsHash: null,
          error: null,
        }),
      );
      await this.supplierChecks.save(
        SUPPLIER_SOURCES.map((source) =>
          this.supplierChecks.create({
            analysisId: created.id,
            source,
            status: 'pending',
            label: null,
            url: null,
            facts: null,
            error: null,
          }),
        ),
      );
      return;
    }

    await this.analyses.update(current.id, {
      status: 'queued',
      error: null,
      updatedAt: new Date(),
    });
    await this.resetSupplierChecks(current.id, current.sources ?? []);
  }

  private async resetSupplierChecks(
    analysisId: string,
    sources: SupplierSourceCheck[],
  ): Promise<void> {
    if (sources.length === 0) {
      await this.supplierChecks.save(
        SUPPLIER_SOURCES.map((source) =>
          this.supplierChecks.create({
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
      return;
    }

    for (const source of sources) {
      await this.supplierChecks.update(source.id, {
        status: 'pending',
        label: null,
        url: null,
        facts: null,
        error: null,
      });
    }
  }

  private async prepareRoute(route: Route): Promise<void> {
    const current = await this.assessments.findOne({
      where: { routeId: route.id },
      order: { updatedAt: 'DESC' },
      relations: { sources: true },
    });
    if (current?.status === 'queued' || current?.status === 'running') {
      return;
    }
    if (!current) {
      const created = await this.assessments.save(
        this.assessments.create({
          routeId: route.id,
          userId: route.userId,
          status: 'queued',
          riskState: null,
          laneStatus: null,
          transitDays: null,
          why: null,
          summary: null,
          factsHash: null,
          error: null,
        }),
      );
      await this.routeChecks.save(
        ROUTE_SOURCES.map((source) =>
          this.routeChecks.create({
            analysisId: created.id,
            source,
            status: 'pending',
            label: null,
            url: null,
            facts: null,
            error: null,
          }),
        ),
      );
      return;
    }

    await this.assessments.update(current.id, {
      status: 'queued',
      error: null,
      updatedAt: new Date(),
    });
    const sources = current.sources ?? [];
    if (sources.length === 0) {
      await this.routeChecks.save(
        ROUTE_SOURCES.map((source) =>
          this.routeChecks.create({
            analysisId: current.id,
            source,
            status: 'pending',
            label: null,
            url: null,
            facts: null,
            error: null,
          }),
        ),
      );
      return;
    }

    for (const source of sources) {
      await this.routeChecks.update(source.id, {
        status: 'pending',
        label: null,
        url: null,
        facts: null,
        error: null,
      });
    }
  }

  private async mark(
    run: PipelineRun,
    agentName: AgentName,
    status: PipelineStageStatus,
    summary: string | null,
    error: string | null = null,
  ): Promise<void> {
    const stage = run.stages?.find((item) => item.agentName === agentName);
    const now = new Date();
    const startedAt = stage?.startedAt ?? now;
    const completedAt =
      status === 'completed' || status === 'failed' ? now : null;
    await this.stages.update(
      { runId: run.id, agentName },
      { status, summary, error, startedAt, completedAt },
    );
    if (stage) {
      stage.status = status;
      stage.summary = summary;
      stage.error = error;
      stage.startedAt = startedAt;
      stage.completedAt = completedAt;
    }
    await this.events.publish({
      type: 'pipeline.stage',
      userId: run.userId,
      runId: run.id,
      agentName,
      status,
      summary,
      done: null,
      total: null,
      kind: null,
    });
  }

  private async progress(
    run: PipelineRun,
    done: number,
    total: number,
    kind: 'supplier' | 'route',
    summary: string,
  ): Promise<void> {
    await this.stages.update(
      { runId: run.id, agentName: 'monitoring' },
      { summary },
    );
    await this.events.publish({
      type: 'pipeline.stage',
      userId: run.userId,
      runId: run.id,
      agentName: 'monitoring',
      status: 'running',
      summary,
      done,
      total,
      kind,
    });
  }

  private failure(kind: string, id: string, error: unknown): string {
    const message = error instanceof Error ? error.message : 'check failed';
    return `${agentLabel('monitoring')} ${kind} ${id}: ${message}`;
  }
}

function countNoun(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function latestByDate<T extends { updatedAt: Date }>(rows: T[]): T | null {
  let latest: T | null = null;
  for (const row of rows) {
    if (!latest || row.updatedAt.getTime() > latest.updatedAt.getTime()) {
      latest = row;
    }
  }
  return latest;
}
