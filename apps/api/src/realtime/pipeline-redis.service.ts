import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PipelineEvent } from '@supplyeagle/types';
import { Redis } from 'ioredis';
import {
  PIPELINE_EVENTS_CHANNEL,
  parsePipelineEvent,
} from './pipeline-events.js';

@Injectable()
export class PipelineRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(PipelineRedisService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.publisher = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    this.subscriber = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.publisher.on('error', (error: Error) => {
      this.logger.error(`Redis publisher error: ${error.message}`);
    });
    this.subscriber.on('error', (error: Error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`);
    });
  }

  async publish(event: PipelineEvent): Promise<void> {
    await this.ensureConnected(this.publisher);
    await this.publisher.publish(
      PIPELINE_EVENTS_CHANNEL,
      JSON.stringify(event),
    );
  }

  async listen(handler: (event: PipelineEvent) => void): Promise<void> {
    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel !== PIPELINE_EVENTS_CHANNEL) {
        return;
      }

      const event = parsePipelineEvent(message);
      if (!event) {
        this.logger.warn('Ignored an unrecognized pipeline event');
        return;
      }

      handler(event);
    });

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      try {
        await this.ensureConnected(this.subscriber);
        await this.subscriber.subscribe(PIPELINE_EVENTS_CHANNEL);
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Redis subscribe failed';
        this.logger.error(
          `Redis subscribe attempt ${attempt} failed: ${message}`,
        );
        await delay(500);
      }
    }

    throw new Error('Could not subscribe to pipeline events');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.quit(this.publisher), this.quit(this.subscriber)]);
  }

  private async ensureConnected(client: Redis): Promise<void> {
    if (client.status === 'wait') {
      await client.connect();
    }
  }

  private async quit(client: Redis): Promise<void> {
    if (client.status === 'wait' || client.status === 'end') {
      return;
    }

    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
