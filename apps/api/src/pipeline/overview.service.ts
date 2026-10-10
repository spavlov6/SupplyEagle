import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  OverviewResponse,
  RiskState,
  RouteRiskCounts,
} from '@supplyeagle/types';
import { Repository } from 'typeorm';
import { Route } from '../routes/route.entity.js';
import { RouteAssessment } from '../routes/route-assessment.entity.js';
import { SupplierAnalysis } from '../suppliers/supplier-analysis.entity.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';

@Injectable()
export class OverviewService {
  constructor(
    @InjectRepository(SupplierAnalysis)
    private readonly analyses: Repository<SupplierAnalysis>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(RouteAssessment)
    private readonly assessments: Repository<RouteAssessment>,
    @InjectRepository(PipelineRun)
    private readonly runs: Repository<PipelineRun>,
  ) {}

  async get(userId: string): Promise<OverviewResponse> {
    const [sanctionedSuppliers, routeStats, lastRun] = await Promise.all([
      this.countSanctioned(userId),
      this.routeStats(userId),
      this.runs.findOne({
        where: { userId, status: 'completed' },
        order: { completedAt: 'DESC' },
      }),
    ]);

    return {
      sanctionedSuppliers,
      disruptedRoutes: routeStats.disrupted,
      lastScanAt: lastRun?.completedAt
        ? lastRun.completedAt.toISOString()
        : null,
      routesByRisk: routeStats.counts,
    };
  }

  private async countSanctioned(userId: string): Promise<number> {
    const analyses = await this.analyses.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    const seen = new Set<string>();
    let count = 0;
    for (const analysis of analyses) {
      if (seen.has(analysis.supplierId)) {
        continue;
      }
      seen.add(analysis.supplierId);
      if (analysis.sanctionsHit === true) {
        count += 1;
      }
    }
    return count;
  }

  private async routeStats(
    userId: string,
  ): Promise<{ disrupted: number; counts: RouteRiskCounts }> {
    const routes = await this.routes.find({ where: { userId } });
    const assessments = await this.assessments.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    const latest = new Map<string, RouteAssessment>();
    for (const assessment of assessments) {
      if (!latest.has(assessment.routeId)) {
        latest.set(assessment.routeId, assessment);
      }
    }

    const counts: RouteRiskCounts = {
      critical: 0,
      elevated: 0,
      watch: 0,
      stable: 0,
      unassessed: 0,
    };
    let disrupted = 0;
    for (const route of routes) {
      const assessment = latest.get(route.id);
      if (assessment?.laneStatus === 'disrupted') {
        disrupted += 1;
      }
      const state = assessment?.riskState ?? null;
      if (!state) {
        counts.unassessed += 1;
      } else {
        counts[bucket(state)] += 1;
      }
    }
    return { disrupted, counts };
  }
}

function bucket(state: RiskState): keyof Omit<RouteRiskCounts, 'unassessed'> {
  switch (state) {
    case 'critical':
    case 'elevated':
    case 'watch':
    case 'stable':
      return state;
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
}
