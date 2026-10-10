import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { AnalysisRunner } from '../analysis/analysis.runner.js';
import { bullConnection, redisUrl } from '../pipeline/bull-connection.js';
import { RouteDiscoveryRunner } from '../route-discovery/route-discovery.runner.js';

@Injectable()
export class RefreshWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshWorker.name);
  private supplierWorker?: Worker;
  private routeWorker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly suppliers: AnalysisRunner,
    private readonly routes: RouteDiscoveryRunner,
  ) {}

  onModuleInit(): void {
    const connection = bullConnection(
      redisUrl(this.config.get<string>('REDIS_URL')),
    );
    this.supplierWorker = new Worker(
      'supplier-refresh',
      async (job: { data: { supplierId: string } }) => {
        await this.suppliers.run(job.data.supplierId);
      },
      { connection, concurrency: 4 },
    );
    this.routeWorker = new Worker(
      'route-refresh',
      async (job: { data: { routeId: string } }) => {
        await this.routes.run(job.data.routeId);
      },
      { connection, concurrency: 2 },
    );
    this.supplierWorker.on('failed', (job, error) => {
      this.logger.error(
        `Supplier refresh failed for ${job?.data.supplierId ?? 'unknown'}: ${error.message}`,
      );
    });
    this.routeWorker.on('failed', (job, error) => {
      this.logger.error(
        `Route refresh failed for ${job?.data.routeId ?? 'unknown'}: ${error.message}`,
      );
    });
  }

  started(): boolean {
    return this.supplierWorker !== undefined && this.routeWorker !== undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.supplierWorker?.close(),
      this.routeWorker?.close(),
    ]);
  }
}
