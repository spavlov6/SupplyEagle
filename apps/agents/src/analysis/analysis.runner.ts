import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SourceFacts, SourceName } from '@supplyeagle/types';
import { In, Repository } from 'typeorm';
import { assessConfidence } from './confidence.js';
import { canonicalCountry } from './countries.js';
import { ClaudeService } from './claude.service.js';
import { Supplier } from './entities/supplier.entity.js';
import { SupplierAnalysis } from './entities/supplier-analysis.entity.js';
import { SupplierSourceCheck } from './entities/supplier-source-check.entity.js';
import { RedisService } from './redis.service.js';
import { SourceClient } from './source.client.js';
import type { SourceResult } from './source-result.js';

type CollectedSource = {
  source: SourceName;
  result: SourceResult;
};

@Injectable()
export class AnalysisRunner {
  private readonly logger = new Logger(AnalysisRunner.name);

  constructor(
    @InjectRepository(SupplierAnalysis)
    private readonly analyses: Repository<SupplierAnalysis>,
    @InjectRepository(SupplierSourceCheck)
    private readonly checks: Repository<SupplierSourceCheck>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    private readonly sources: SourceClient,
    private readonly claude: ClaudeService,
    private readonly redis: RedisService,
  ) {}

  async run(supplierId: string): Promise<void> {
    const analysis = await this.analyses.findOne({
      where: { supplierId, status: In(['queued', 'running']) },
      relations: { supplier: true },
      order: { createdAt: 'DESC' },
    });

    if (!analysis?.supplier) {
      return;
    }

    const supplier = analysis.supplier;
    try {
      await this.markRunning(analysis);
      const collected = await this.collectSources(analysis, supplier.name);
      const assessment = assessConfidence(
        collected.map((item) => ({
          source: item.source,
          status: item.result.status,
          facts: item.result.facts,
        })),
      );

      if (assessment.confidence === 'verified' && assessment.country) {
        await this.suppliers.update(supplier.id, {
          country: assessment.country,
        });
      }

      try {
        const summary = await this.claude.summarize({
          supplierName: supplier.name,
          assessment,
          sources: collected,
        });
        await this.analyses.update(analysis.id, {
          status: 'completed',
          confidence: assessment.confidence,
          summary,
          legalName: assessment.legalName,
          country: assessment.country,
          sanctionsHit: assessment.sanctionsHit,
          error: null,
          updatedAt: new Date(),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Claude request failed';
        this.logger.error(
          `Claude summary failed for ${supplierId}: ${message}`,
        );
        await this.analyses.update(analysis.id, {
          status: 'failed',
          confidence: assessment.confidence,
          summary: null,
          legalName: assessment.legalName,
          country: assessment.country,
          sanctionsHit: assessment.sanctionsHit,
          error: message,
          updatedAt: new Date(),
        });
      }

      await this.publish(analysis.userId, analysis.supplierId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Analysis failed';
      this.logger.error(`Analysis failed for ${supplierId}: ${message}`);
      await this.analyses.update(analysis.id, {
        status: 'failed',
        error: message,
        updatedAt: new Date(),
      });
      await this.publish(analysis.userId, analysis.supplierId);
    }
  }

  private async markRunning(analysis: SupplierAnalysis): Promise<void> {
    await this.analyses.update(analysis.id, {
      status: 'running',
      error: null,
      updatedAt: new Date(),
    });
    await this.publish(analysis.userId, analysis.supplierId);
  }

  private async collectSources(
    analysis: SupplierAnalysis,
    supplierName: string,
  ): Promise<CollectedSource[]> {
    const checks = await this.checks.find({
      where: { analysisId: analysis.id },
    });
    return Promise.all(
      checks.map(async (check) => {
        const fetched = await this.sources.fetch(check.source, supplierName);
        const result: SourceResult = {
          ...fetched,
          facts: canonicalizeFacts(fetched.facts),
        };
        await this.checks.update(check.id, {
          status: result.status,
          label: result.label,
          url: result.url,
          facts: result.facts,
          error: result.error,
        });
        await this.publish(analysis.userId, analysis.supplierId);
        return { source: check.source, result };
      }),
    );
  }

  private publish(userId: string, supplierId: string): Promise<void> {
    return this.redis.publish({
      type: 'analysis.updated',
      userId,
      supplierId,
    });
  }
}

function canonicalizeFacts(facts: SourceFacts | null): SourceFacts | null {
  if (!facts) {
    return null;
  }

  return {
    ...facts,
    country: canonicalCountry(facts.country),
  };
}
