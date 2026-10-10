import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineSchedule } from './entities/pipeline-schedule.entity.js';
import { PipelineRedisService } from './pipeline-redis.service.js';
import { PipelineScheduler } from './pipeline.scheduler.js';
import { ScanQueue } from './scan.queue.js';

const userId = '11111111-1111-1111-1111-111111111111';

describe('PipelineScheduler', () => {
  const schedules = {
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const runs = { find: vi.fn() };
  const queue = {
    upsertJobScheduler: vi.fn(async () => ({ id: `scan-${userId}` })),
    removeJobScheduler: vi.fn(),
    getJobSchedulers: vi.fn(async () => [
      { id: 'scan-stale-user', key: 'scan-stale-user' },
    ]),
    getJobScheduler: vi.fn(async () => ({ next: 1_800_000_000_000 })),
  };
  const scanQueue = {
    queue,
    addRun: vi.fn(),
  };
  const events = { publish: vi.fn() };

  let scheduler: PipelineScheduler;

  beforeEach(async () => {
    vi.clearAllMocks();
    schedules.findOne.mockResolvedValue({
      id: 'schedule-1',
      userId,
      enabled: true,
      hour: 8,
      minute: 0,
      timezone: 'Europe/Sofia',
      nextRunAt: null,
    });
    schedules.find.mockImplementation(
      async (query: { where: { enabled: boolean } }) => {
        if (query.where.enabled) {
          return [
            {
              id: 'schedule-1',
              userId,
              enabled: true,
              hour: 8,
              minute: 0,
              timezone: 'Europe/Sofia',
              nextRunAt: null,
            },
          ];
        }
        return [];
      },
    );
    runs.find.mockResolvedValue([{ id: 'run-1', userId, status: 'queued' }]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PipelineScheduler,
        {
          provide: ConfigService,
          useValue: { get: () => 'redis://localhost:6379' },
        },
        { provide: ScanQueue, useValue: scanQueue },
        { provide: PipelineRedisService, useValue: events },
        { provide: getRepositoryToken(PipelineSchedule), useValue: schedules },
        { provide: getRepositoryToken(PipelineRun), useValue: runs },
      ],
    }).compile();
    scheduler = moduleRef.get(PipelineScheduler);
  });

  it('upserts enabled schedules, drops stale ones, and requeues an open run', async () => {
    await scheduler.reconcile();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      `scan-${userId}`,
      { pattern: '0 8 * * *', tz: 'Europe/Sofia' },
      expect.objectContaining({ name: 'scheduled-scan', data: { userId } }),
    );
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('scan-stale-user');
    expect(scanQueue.addRun).toHaveBeenCalledWith(userId, 'run-1');
    expect(events.publish).toHaveBeenCalledWith({
      type: 'schedule.applied',
      userId,
    });
  });

  it('removes the scheduler when the account turns the scan off', async () => {
    schedules.findOne.mockResolvedValue({
      id: 'schedule-1',
      userId,
      enabled: false,
      nextRunAt: new Date(),
    });

    await scheduler.apply(userId);

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(`scan-${userId}`);
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(schedules.update).toHaveBeenCalledWith('schedule-1', {
      nextRunAt: null,
    });
  });
});
