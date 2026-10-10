import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';
import { AGENT_ORDER } from './agents.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineStageRecord } from './entities/pipeline-stage.entity.js';

export async function claimScan(
  manager: EntityManager,
  userId: string,
): Promise<{ run: PipelineRun; created: boolean }> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
    `scan-${userId}`,
  ]);
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
      manager.create(PipelineStageRecord, {
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
}
