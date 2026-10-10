import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RouteAssessment } from './entities/route-assessment.entity.js';
import { RouteDiscoveryRunner } from './route-discovery.runner.js';
import { RouteRedisService } from './route-redis.service.js';

@Injectable()
export class RouteDiscoverySubscriber implements OnModuleInit {
  private readonly logger = new Logger(RouteDiscoverySubscriber.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly redis: RouteRedisService,
    private readonly runner: RouteDiscoveryRunner,
    @InjectRepository(RouteAssessment)
    private readonly assessments: Repository<RouteAssessment>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.listen((event) => {
      switch (event.type) {
        case 'route.created':
        case 'route.reassess':
          this.enqueue(event.routeId);
          return;
        case 'route.assessment.updated':
          return;
        default: {
          const unexpected: never = event;
          void unexpected;
          return;
        }
      }
    });
    await this.recover();
  }

  private enqueue(routeId: string): void {
    if (this.running.has(routeId)) {
      return;
    }

    this.running.add(routeId);
    void this.runner
      .run(routeId)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Route assessment failed';
        this.logger.error(`Route assessment crashed for ${routeId}: ${message}`);
      })
      .finally(() => {
        this.running.delete(routeId);
      });
  }

  private async recover(): Promise<void> {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const pending = await this.assessments.find({
          where: { status: In(['queued', 'running']) },
        });
        for (const row of pending) {
          this.enqueue(row.routeId);
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'recovery failed';
        this.logger.warn(`Route assessment recovery attempt ${attempt} failed: ${message}`);
        await delay(attempt * 1_000);
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
