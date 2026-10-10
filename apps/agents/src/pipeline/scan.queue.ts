import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { runJobId } from './agents.js';
import { bullConnection, redisUrl } from './bull-connection.js';

export type AccountJob = {
  userId: string;
  runId?: string;
};

@Injectable()
export class ScanQueue implements OnModuleDestroy {
  private readonly logger = new Logger(ScanQueue.name);
  readonly queue: Queue<AccountJob>;

  constructor(config: ConfigService) {
    this.queue = new Queue<AccountJob>('account-scan', {
      connection: bullConnection(redisUrl(config.get<string>('REDIS_URL'))),
    });
  }

  async addRun(userId: string, runId: string): Promise<void> {
    const jobId = runJobId(runId);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'completed' && state !== 'failed') {
        return;
      }
      await existing.remove().catch(() => undefined);
    }

    try {
      await this.queue.add(
        'run',
        { userId, runId },
        { jobId, removeOnComplete: true, removeOnFail: 20 },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'queue add failed';
      this.logger.warn(`Scan ${runId} was already queued: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
