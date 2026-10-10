import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  Alert as AlertResponse,
  AlertListResponse,
  AlertStatus,
} from '@supplyeagle/types';
import { In, Repository } from 'typeorm';
import { Route } from '../routes/route.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { Alert } from './entities/alert.entity.js';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alerts: Repository<Alert>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
  ) {}

  async list(userId: string, status: AlertStatus): Promise<AlertListResponse> {
    const rows = await this.alerts.find({
      where: { userId, status },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return { alerts: await this.hydrate(userId, rows) };
  }

  async countOpen(userId: string): Promise<number> {
    return this.alerts.count({ where: { userId, status: 'open' } });
  }

  async acknowledge(userId: string, id: string): Promise<AlertResponse> {
    const alert = await this.owned(userId, id);
    if (alert.status === 'dismissed') {
      throw new ConflictException('A dismissed alert cannot be acknowledged');
    }
    if (alert.status !== 'acknowledged') {
      await this.alerts.update(alert.id, { status: 'acknowledged' });
      alert.status = 'acknowledged';
    }
    const [hydrated] = await this.hydrate(userId, [alert]);
    if (!hydrated) {
      throw new NotFoundException('Alert not found');
    }
    return hydrated;
  }

  async dismiss(userId: string, id: string): Promise<AlertResponse> {
    const alert = await this.owned(userId, id);
    if (alert.status !== 'dismissed') {
      await this.alerts.update(alert.id, { status: 'dismissed' });
      alert.status = 'dismissed';
    }
    const [hydrated] = await this.hydrate(userId, [alert]);
    if (!hydrated) {
      throw new NotFoundException('Alert not found');
    }
    return hydrated;
  }

  async owned(userId: string, id: string): Promise<Alert> {
    const alert = await this.alerts.findOne({ where: { id, userId } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return alert;
  }

  async hydrate(userId: string, rows: Alert[]): Promise<AlertResponse[]> {
    const supplierIds = unique(rows.map((row) => row.supplierId));
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
      severity: row.severity,
      title: row.title,
      description: row.description,
      status: row.status,
      supplierId: row.supplierId,
      routeId: row.routeId,
      supplierName: row.supplierId
        ? (supplierName.get(row.supplierId) ?? null)
        : null,
      routeLabel: row.routeId ? (routeLabel.get(row.routeId) ?? null) : null,
      recommendationId: row.recommendationId,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

export function parseAlertStatus(value: string | undefined): AlertStatus {
  if (value === undefined || value === 'open') {
    return 'open';
  }
  if (value === 'acknowledged' || value === 'dismissed') {
    return value;
  }
  throw new BadRequestException(
    'status must be open, acknowledged, or dismissed',
  );
}

function unique(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => value !== null)),
  ];
}
