import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, type Job } from 'bullmq';
import { bullConnection, redisUrl } from '../pipeline/bull-connection.js';

const SUPPLIER_QUEUE = 'supplier-refresh';
const ROUTE_QUEUE = 'route-refresh';
const WAIT_MS = 30 * 60 * 1000;

type SupplierJob = { supplierId: string };
type RouteJob = { routeId: string };

@Injectable()
export class RefreshQueue implements OnModuleDestroy {
  private readonly logger = new Logger(RefreshQueue.name);
  private readonly supplierQueue: Queue<SupplierJob>;
  private readonly routeQueue: Queue<RouteJob>;
  private readonly supplierEvents: QueueEvents;
  private readonly routeEvents: QueueEvents;

  constructor(config: ConfigService) {
    const connection = bullConnection(
      redisUrl(config.get<string>('REDIS_URL')),
    );
    this.supplierQueue = new Queue(SUPPLIER_QUEUE, { connection });
    this.routeQueue = new Queue(ROUTE_QUEUE, { connection });
    this.supplierEvents = new QueueEvents(SUPPLIER_QUEUE, { connection });
    this.routeEvents = new QueueEvents(ROUTE_QUEUE, { connection });
  }

  addSupplier(supplierId: string): Promise<void> {
    return this.add(
      this.supplierQueue,
      'refresh',
      { supplierId },
      `supplier-${supplierId}`,
    );
  }

  addRoute(routeId: string): Promise<void> {
    return this.add(
      this.routeQueue,
      'refresh',
      { routeId },
      `route-${routeId}`,
    );
  }

  waitForSupplier(supplierId: string): Promise<void> {
    return this.wait(
      this.supplierQueue,
      this.supplierEvents,
      `supplier-${supplierId}`,
    );
  }

  waitForRoute(routeId: string): Promise<void> {
    return this.wait(this.routeQueue, this.routeEvents, `route-${routeId}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.supplierQueue.close(),
      this.routeQueue.close(),
      this.supplierEvents.close(),
      this.routeEvents.close(),
    ]);
  }

  private async add<T>(
    queue: Queue<T>,
    name: string,
    data: T,
    jobId: string,
  ): Promise<void> {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'completed' && state !== 'failed') {
        return;
      }
      await existing.remove().catch(() => undefined);
    }

    try {
      await queue.add(name as never, data as never, {
        jobId,
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'queue add failed';
      this.logger.warn(`Refresh ${jobId} was already queued: ${message}`);
    }
  }

  private async wait(
    queue: Queue,
    events: QueueEvents,
    jobId: string,
  ): Promise<void> {
    const job = await queue.getJob(jobId);
    if (!job) {
      return;
    }

    const state = await job.getState();
    if (state === 'completed' || state === 'unknown') {
      return;
    }
    if (state === 'failed') {
      throw new Error(`Refresh ${jobId} failed`);
    }

    await finished(job, events);
  }
}

function finished(job: Job, events: QueueEvents): Promise<void> {
  return job.waitUntilFinished(events, WAIT_MS).then(() => undefined);
}
