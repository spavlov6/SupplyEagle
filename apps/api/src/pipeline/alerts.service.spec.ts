import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Route } from '../routes/route.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { AlertsService } from './alerts.service.js';
import { Alert } from './entities/alert.entity.js';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const alertId = '33333333-3333-3333-3333-333333333333';

function alert(status: Alert['status'] = 'open'): Alert {
  return {
    id: alertId,
    userId,
    type: 'sanctions',
    severity: 'critical',
    title: 'Sanctions record',
    description: 'Matched',
    status,
    supplierId: null,
    routeId: null,
    sourceKey: 'sanctions-1',
    recommendationId: null,
    runId: null,
    createdAt: new Date('2026-10-10T08:00:00.000Z'),
    updatedAt: new Date('2026-10-10T08:00:00.000Z'),
  };
}

describe('AlertsService', () => {
  const alerts = {
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  const suppliers = { find: vi.fn(async () => []) };
  const routes = { find: vi.fn(async () => []) };

  let service: AlertsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useValue: alerts },
        { provide: getRepositoryToken(Supplier), useValue: suppliers },
        { provide: getRepositoryToken(Route), useValue: routes },
      ],
    }).compile();
    service = moduleRef.get(AlertsService);
  });

  it('lists only the signed-in account', async () => {
    alerts.find.mockResolvedValue([alert()]);

    const result = await service.list(userId, 'open');

    expect(alerts.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId, status: 'open' } }),
    );
    expect(result.alerts[0]?.id).toBe(alertId);
  });

  it('does not acknowledge another account or a dismissed alert', async () => {
    alerts.findOne.mockResolvedValue(null);
    await expect(
      service.acknowledge(otherUserId, alertId),
    ).rejects.toBeInstanceOf(NotFoundException);

    alerts.findOne.mockResolvedValue(alert('dismissed'));
    await expect(service.acknowledge(userId, alertId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(alerts.update).not.toHaveBeenCalled();
  });

  it('dismisses an open alert', async () => {
    alerts.findOne.mockResolvedValue(alert('open'));
    alerts.update.mockResolvedValue(undefined);

    const result = await service.dismiss(userId, alertId);

    expect(alerts.update).toHaveBeenCalledWith(alertId, {
      status: 'dismissed',
    });
    expect(result.status).toBe('dismissed');
  });
});
