import type { PipelineRunStatus, ScanBaseline } from '@supplyeagle/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PipelineStageRecord } from './pipeline-stage.entity.js';

@Entity('pipeline_runs')
export class PipelineRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: PipelineRunStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  baseline: ScanBaseline | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany('PipelineStageRecord', 'run')
  stages?: PipelineStageRecord[];
}
