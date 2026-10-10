import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { bullConnection, redisUrl } from './bull-connection.js';
import type { AccountJob } from './scan.queue.js';
import { ScanService } from './scan.service.js';

@Injectable()
export class ScanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanWorker.name);
  private worker?: Worker<AccountJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly scan: ScanService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<AccountJob>(
      'account-scan',
      async (job) => {
        if (job.name === 'scheduled-scan') {
          await this.scan.schedule(job.data.userId);
          return;
        }
        if (job.name === 'run' && job.data.runId) {
          await this.scan.execute(job.data.runId);
        }
      },
      {
        connection: bullConnection(
          redisUrl(this.config.get<string>('REDIS_URL')),
        ),
        concurrency: 2,
        lockDuration: 120_000,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Scan job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
