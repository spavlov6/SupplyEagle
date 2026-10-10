import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SupplierAnalysis } from '../analysis/entities/supplier-analysis.entity.js';
import { RedisService } from '../analysis/redis.service.js';
import { RouteAssessment } from '../route-discovery/entities/route-assessment.entity.js';
import { RouteRedisService } from '../route-discovery/route-redis.service.js';
import { RefreshQueue } from './refresh.queue.js';
import { RefreshWorker } from './refresh.worker.js';

@Injectable()
export class RefreshSubscriber implements OnModuleInit {
  private readonly logger = new Logger(RefreshSubscriber.name);

  constructor(
    private readonly worker: RefreshWorker,
    private readonly queue: RefreshQueue,
    private readonly suppliers: RedisService,
    private readonly routes: RouteRedisService,
    @InjectRepository(SupplierAnalysis)
    private readonly analyses: Repository<SupplierAnalysis>,
    @InjectRepository(RouteAssessment)
    private readonly assessments: Repository<RouteAssessment>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.worker.started()) {
      this.logger.warn('Refresh workers were not started before recovery');
    }
    await this.suppliers.listen((event) => {
      switch (event.type) {
        case 'supplier.created':
        case 'supplier.reassess':
          void this.queue
            .addSupplier(event.supplierId)
            .catch((error: unknown) => {
              this.warn('supplier', event.supplierId, error);
            });
          return;
        case 'analysis.updated':
          return;
        default: {
          const unexpected: never = event;
          void unexpected;
        }
      }
    });
    await this.routes.listen((event) => {
      switch (event.type) {
        case 'route.created':
        case 'route.reassess':
          void this.queue.addRoute(event.routeId).catch((error: unknown) => {
            this.warn('route', event.routeId, error);
          });
          return;
        case 'route.assessment.updated':
          return;
        default: {
          const unexpected: never = event;
          void unexpected;
        }
      }
    });
    await this.recover();
  }

  private async recover(): Promise<void> {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const suppliers = await this.analyses.find({
          where: { status: In(['queued', 'running']) },
        });
        const routes = await this.assessments.find({
          where: { status: In(['queued', 'running']) },
        });
        for (const row of suppliers) {
          await this.queue.addSupplier(row.supplierId);
        }
        for (const row of routes) {
          await this.queue.addRoute(row.routeId);
        }
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'recovery failed';
        this.logger.warn(
          `Refresh recovery attempt ${attempt} failed: ${message}`,
        );
        await delay(attempt * 1_000);
      }
    }
  }

  private warn(kind: string, id: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'enqueue failed';
    this.logger.error(`Could not queue ${kind} ${id}: ${message}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
