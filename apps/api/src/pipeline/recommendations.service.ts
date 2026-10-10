import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  Recommendation as RecommendationResponse,
  RecommendationListResponse,
  RecommendationPlan,
  RecommendationStatus,
} from '@supplyeagle/types';
import { In, Repository } from 'typeorm';
import { Route } from '../routes/route.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { AlertsService } from './alerts.service.js';
import { Alert } from './entities/alert.entity.js';
import { Recommendation } from './entities/recommendation.entity.js';

const INVESTIGATE_PLAN: RecommendationPlan = {
  steps: [
    'Confirm the evidence on the named supplier or lane.',
    'Decide whether that supplier or lane stays in use.',
    'Record the outcome on the recommendation.',
  ],
};

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Recommendation)
    private readonly recommendations: Repository<Recommendation>,
    @InjectRepository(Alert)
    private readonly alerts: Repository<Alert>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    private readonly alertsService: AlertsService,
  ) {}

  async list(
    userId: string,
    status: RecommendationStatus,
  ): Promise<RecommendationListResponse> {
    const rows = await this.recommendations.find({
      where: { userId, status },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return { recommendations: await this.hydrate(userId, rows) };
  }

  async get(userId: string, id: string): Promise<RecommendationResponse> {
    const row = await this.owned(userId, id);
    const [hydrated] = await this.hydrate(userId, [row]);
    if (!hydrated) {
      throw new NotFoundException('Recommendation not found');
    }
    return hydrated;
  }

  async accept(userId: string, id: string): Promise<RecommendationResponse> {
    return this.transition(userId, id, 'accepted');
  }

  async dismiss(userId: string, id: string): Promise<RecommendationResponse> {
    return this.transition(userId, id, 'dismissed');
  }

  async openForAlert(
    userId: string,
    alertId: string,
  ): Promise<RecommendationResponse> {
    const alert = await this.alertsService.owned(userId, alertId);
    if (alert.recommendationId) {
      const existing = await this.recommendations.findOne({
        where: { id: alert.recommendationId, userId },
      });
      if (existing) {
        return this.get(userId, existing.id);
      }
    }

    const saved = await this.recommendations.save(
      this.recommendations.create({
        userId,
        alertId: alert.id,
        runId: alert.runId,
        type: 'investigate',
        title: alert.title,
        description: alert.description,
        priority: 3,
        status: 'pending',
        supplierId: alert.supplierId,
        routeId: alert.routeId,
        alternativeSupplierId: null,
        plan: INVESTIGATE_PLAN,
      }),
    );
    await this.alerts.update(alert.id, { recommendationId: saved.id });
    return this.get(userId, saved.id);
  }

  private async transition(
    userId: string,
    id: string,
    status: 'accepted' | 'dismissed',
  ): Promise<RecommendationResponse> {
    const row = await this.owned(userId, id);
    if (row.status === status) {
      return this.get(userId, id);
    }
    if (row.status !== 'pending') {
      throw new ConflictException('This recommendation is already closed');
    }
    await this.recommendations.update(row.id, { status });
    row.status = status;
    return this.get(userId, id);
  }

  private async owned(userId: string, id: string): Promise<Recommendation> {
    const row = await this.recommendations.findOne({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Recommendation not found');
    }
    return row;
  }

  private async hydrate(
    userId: string,
    rows: Recommendation[],
  ): Promise<RecommendationResponse[]> {
    const supplierIds = unique(
      rows.flatMap((row) => [row.supplierId, row.alternativeSupplierId]),
    );
    const routeIds = unique(rows.map((row) => row.routeId));
    const suppliers =
      supplierIds.length === 0
        ? []
        : await this.suppliers.find({ where: { userId, id: In(supplierIds) } });
    const routes =
      routeIds.length === 0
        ? []
        : await this.routes.find({ where: { userId, id: In(routeIds) } });
    const supplierName = new Map(
      suppliers.map((supplier) => [supplier.id, supplier.name]),
    );
    const routeLabel = new Map(
      routes.map((route) => [
        route.id,
        `${route.origin} to ${route.destination}`,
      ]),
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      supplierId: row.supplierId,
      routeId: row.routeId,
      supplierName: row.supplierId
        ? (supplierName.get(row.supplierId) ?? null)
        : null,
      routeLabel: row.routeId ? (routeLabel.get(row.routeId) ?? null) : null,
      alternativeSupplierId: row.alternativeSupplierId,
      alternativeSupplierName: row.alternativeSupplierId
        ? (supplierName.get(row.alternativeSupplierId) ?? null)
        : null,
      plan: row.plan,
      alertId: row.alertId,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

export function parseRecommendationStatus(
  value: string | undefined,
): RecommendationStatus {
  if (value === undefined || value === 'pending') {
    return 'pending';
  }
  if (value === 'accepted' || value === 'dismissed') {
    return value;
  }
  throw new BadRequestException(
    'status must be pending, accepted, or dismissed',
  );
}

function unique(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => value !== null)),
  ];
}
