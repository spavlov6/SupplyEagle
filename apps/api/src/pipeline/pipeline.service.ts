import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type {
  PipelineRun as PipelineRunResponse,
  PipelineRunListResponse,
  PipelineSchedule as PipelineScheduleResponse,
  PipelineStage as PipelineStageResponse,
  PipelineStatusResponse,
} from '@supplyeagle/types';
import { DataSource, In, Repository } from 'typeorm';
import { PipelineRedisService } from '../realtime/pipeline-redis.service.js';
import {
  AGENT_ORDER,
  DEFAULT_SCAN_HOUR,
  DEFAULT_SCAN_MINUTE,
  DEFAULT_SCAN_TIMEZONE,
} from './agents.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineSchedule } from './entities/pipeline-schedule.entity.js';
import { PipelineStage } from './entities/pipeline-stage.entity.js';
import { isIanaTimeZone } from './timezone.js';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PipelineSchedule)
    private readonly schedules: Repository<PipelineSchedule>,
    @InjectRepository(PipelineRun)
    private readonly runs: Repository<PipelineRun>,
    private readonly events: PipelineRedisService,
  ) {}

  async status(userId: string): Promise<PipelineStatusResponse> {
    const schedule = await this.ensureSchedule(userId);
    const active = await this.runs.findOne({
      where: { userId, status: In(['queued', 'running']) },
      relations: { stages: true },
      order: { createdAt: 'DESC' },
    });
    const latest = await this.runs.findOne({
      where: { userId, status: In(['completed', 'failed']) },
      relations: { stages: true },
      order: { createdAt: 'DESC' },
    });
    return {
      schedule: toSchedule(schedule),
      activeRun: active ? toRun(active) : null,
      latestRun: latest ? toRun(latest) : null,
    };
  }

  async listRuns(userId: string): Promise<PipelineRunListResponse> {
    const runs = await this.runs.find({
      where: { userId },
      relations: { stages: true },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return { runs: runs.map((run) => toRun(run)) };
  }

  async trigger(userId: string): Promise<PipelineRunResponse> {
    const claimed = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
        [`scan-${userId}`],
      );
      const existing = await manager.findOne(PipelineRun, {
        where: { userId, status: In(['queued', 'running']) },
        relations: { stages: true },
      });
      if (existing) {
        return { run: existing, created: false };
      }

      const run = await manager.save(
        manager.create(PipelineRun, {
          userId,
          status: 'queued',
          startedAt: null,
          completedAt: null,
          baseline: null,
        }),
      );
      run.stages = await manager.save(
        AGENT_ORDER.map((agentName) =>
          manager.create(PipelineStage, {
            runId: run.id,
            agentName,
            status: 'pending',
            summary: null,
            error: null,
            startedAt: null,
            completedAt: null,
          }),
        ),
      );
      return { run, created: true };
    });

    if (claimed.created) {
      await this.publish({
        type: 'pipeline.requested',
        userId,
        runId: claimed.run.id,
      });
    }

    return toRun(claimed.run);
  }

  async pinLocalClock(
    userId: string,
    timezone: string,
  ): Promise<PipelineScheduleResponse> {
    if (!isIanaTimeZone(timezone)) {
      throw new BadRequestException('timezone must be an IANA name');
    }

    const current = await this.ensureSchedule(userId);
    const already =
      current.enabled &&
      current.hour === DEFAULT_SCAN_HOUR &&
      current.minute === DEFAULT_SCAN_MINUTE &&
      current.timezone === timezone;
    if (already) {
      return toSchedule(current);
    }

    await this.schedules.update(current.id, {
      enabled: true,
      hour: DEFAULT_SCAN_HOUR,
      minute: DEFAULT_SCAN_MINUTE,
      timezone,
      nextRunAt: null,
    });
    await this.publish({ type: 'schedule.updated', userId });
    const saved = await this.schedules.findOne({ where: { id: current.id } });
    if (!saved) {
      throw new BadRequestException('Schedule could not be saved');
    }
    return toSchedule(saved);
  }

  private async ensureSchedule(userId: string): Promise<PipelineSchedule> {
    const existing = await this.schedules.findOne({ where: { userId } });
    if (existing) {
      if (existing.enabled && !existing.nextRunAt) {
        await this.publish({ type: 'schedule.updated', userId });
      }
      return existing;
    }

    const created = await this.schedules.save(
      this.schedules.create({
        userId,
        enabled: true,
        hour: DEFAULT_SCAN_HOUR,
        minute: DEFAULT_SCAN_MINUTE,
        timezone: DEFAULT_SCAN_TIMEZONE,
        nextRunAt: null,
      }),
    );
    await this.publish({ type: 'schedule.updated', userId });
    return created;
  }

  private async publish(
    event: Parameters<PipelineRedisService['publish']>[0],
  ): Promise<void> {
    try {
      await this.events.publish(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'publish failed';
      this.logger.error(message);
    }
  }
}

function toSchedule(row: PipelineSchedule): PipelineScheduleResponse {
  return {
    enabled: row.enabled,
    hour: row.hour,
    minute: row.minute,
    timezone: row.timezone,
    nextRunAt: row.nextRunAt ? row.nextRunAt.toISOString() : null,
  };
}

function toRun(row: PipelineRun): PipelineRunResponse {
  const stages = row.stages ?? [];
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    stages: AGENT_ORDER.flatMap((agentName) => {
      const stage = stages.find((item) => item.agentName === agentName);
      return stage ? [toStage(stage)] : [];
    }),
  };
}

function toStage(stage: PipelineStage): PipelineStageResponse {
  return {
    agentName: stage.agentName,
    status: stage.status,
    summary: stage.summary,
    error: stage.error,
    startedAt: stage.startedAt ? stage.startedAt.toISOString() : null,
    completedAt: stage.completedAt ? stage.completedAt.toISOString() : null,
  };
}
