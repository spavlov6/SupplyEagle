import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnalysisRunner } from './analysis.runner.js';
import { SupplierAnalysis } from './entities/supplier-analysis.entity.js';
import { RedisService } from './redis.service.js';

@Injectable()
export class AnalysisSubscriber implements OnModuleInit {
  private readonly logger = new Logger(AnalysisSubscriber.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly redis: RedisService,
    private readonly runner: AnalysisRunner,
    @InjectRepository(SupplierAnalysis)
    private readonly analyses: Repository<SupplierAnalysis>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.listen((event) => {
      switch (event.type) {
        case 'supplier.created':
        case 'supplier.reassess':
          this.enqueue(event.supplierId);
          return;
        case 'analysis.updated':
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

  private enqueue(supplierId: string): void {
    if (this.running.has(supplierId)) {
      return;
    }

    this.running.add(supplierId);
    void this.runner
      .run(supplierId)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Analysis failed';
        this.logger.error(`Analysis crashed for ${supplierId}: ${message}`);
      })
      .finally(() => {
        this.running.delete(supplierId);
      });
  }

  private async recover(): Promise<void> {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const pending = await this.analyses.find({
          where: { status: In(['queued', 'running']) },
        });
        for (const row of pending) {
          this.enqueue(row.supplierId);
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'recovery failed';
        this.logger.warn(`Analysis recovery attempt ${attempt} failed: ${message}`);
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
