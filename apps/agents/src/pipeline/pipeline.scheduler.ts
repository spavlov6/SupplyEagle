import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { In, Repository } from 'typeorm';
import { scanPattern, schedulerId } from './agents.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineSchedule } from './entities/pipeline-schedule.entity.js';
import { PipelineRedisService } from './pipeline-redis.service.js';
import { redisUrl } from './bull-connection.js';
import { ScanQueue } from './scan.queue.js';

@Injectable()
export class PipelineScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineScheduler.name);
  private readonly redis: Redis;
  private reconciling: Promise<void> = Promise.resolve();

  constructor(
    config: ConfigService,
    private readonly queue: ScanQueue,
    private readonly events: PipelineRedisService,
    @InjectRepository(PipelineSchedule)
    private readonly schedules: Repository<PipelineSchedule>,
    @InjectRepository(PipelineRun)
    private readonly runs: Repository<PipelineRun>,
  ) {
    this.redis = new Redis(redisUrl(config.get<string>('REDIS_URL')), {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.redis.on('error', (error: Error) => {
      this.logger.error(`Redis ready listener error: ${error.message}`);
    });
    this.redis.on('ready', () => {
      void this.reconcile();
    });
  }

  async onModuleInit(): Promise<void> {
    await this.events.listen((event) => {
      switch (event.type) {
        case 'pipeline.requested':
          void this.queue
            .addRun(event.userId, event.runId)
            .catch((error: unknown) => {
              this.logger.error(messageOf(error));
            });
          return;
        case 'schedule.updated':
          void this.apply(event.userId).catch((error: unknown) => {
            this.logger.error(messageOf(error));
          });
          return;
        case 'schedule.applied':
        case 'pipeline.started':
        case 'pipeline.stage':
        case 'pipeline.completed':
        case 'alert.created':
        case 'recommendation.created':
          return;
        default: {
          const unexpected: never = event;
          void unexpected;
        }
      }
    });
    await this.reconcile();
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      return;
    }
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  reconcile(): Promise<void> {
    this.reconciling = this.reconciling
      .then(() => this.reconcileOnce())
      .catch((error: unknown) => {
        this.logger.error(`Schedule reconcile failed: ${messageOf(error)}`);
      });
    return this.reconciling;
  }

  async apply(userId: string): Promise<void> {
    const row = await this.schedules.findOne({ where: { userId } });
    const id = schedulerId(userId);
    if (!row?.enabled) {
      await this.queue.queue.removeJobScheduler(id);
      if (row?.nextRunAt) {
        await this.schedules.update(row.id, { nextRunAt: null });
      }
    } else {
      await this.queue.queue.upsertJobScheduler(
        id,
        { pattern: scanPattern(row.hour, row.minute), tz: row.timezone },
        {
          name: 'scheduled-scan',
          data: { userId },
          opts: { removeOnComplete: true, removeOnFail: 20 },
        },
      );
      const scheduler = await this.queue.queue.getJobScheduler(id);
      const nextRunAt =
        typeof scheduler?.next === 'number' ? new Date(scheduler.next) : null;
      await this.schedules.update(row.id, { nextRunAt });
    }

    await this.events.publish({ type: 'schedule.applied', userId });
  }

  private async reconcileOnce(): Promise<void> {
    const enabled = await this.schedules.find({ where: { enabled: true } });
    const disabled = await this.schedules.find({ where: { enabled: false } });
    for (const row of enabled) {
      await this.apply(row.userId);
    }
    for (const row of disabled) {
      await this.queue.queue.removeJobScheduler(schedulerId(row.userId));
      if (row.nextRunAt) {
        await this.schedules.update(row.id, { nextRunAt: null });
      }
    }

    const wanted = new Set(enabled.map((row) => schedulerId(row.userId)));
    const existing = await this.queue.queue.getJobSchedulers();
    for (const scheduler of existing) {
      const id = scheduler.id ?? scheduler.key;
      if (id.startsWith('scan-') && !wanted.has(id)) {
        await this.queue.queue.removeJobScheduler(id);
      }
    }

    const runs = await this.runs.find({
      where: { status: In(['queued', 'running']) },
    });
    for (const run of runs) {
      await this.queue.addRun(run.userId, run.id);
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'pipeline scheduling failed';
}
