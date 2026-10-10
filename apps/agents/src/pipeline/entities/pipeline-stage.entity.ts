import type { AgentName, PipelineStageStatus } from '@supplyeagle/types';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { PipelineRun } from './pipeline-run.entity.js';

@Entity('pipeline_stages')
@Unique('pipeline_stages_run_agent', ['runId', 'agentName'])
export class PipelineStageRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  runId: string;

  @ManyToOne('PipelineRun', 'stages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runId' })
  run?: PipelineRun;

  @Column({ type: 'varchar', length: 32 })
  agentName: AgentName;

  @Column({ type: 'varchar', length: 20 })
  status: PipelineStageStatus;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
