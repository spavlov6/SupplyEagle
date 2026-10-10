import type { AnalysisStatus, LaneStatus, RiskState } from '@supplyeagle/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Route } from './route.entity.js';
import type { RouteSourceCheck } from './route-source-check.entity.js';

@Entity('route_assessments')
export class RouteAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  routeId: string;

  @ManyToOne('Route', 'assessments', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route?: Route;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: AnalysisStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  riskState: RiskState | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  laneStatus: LaneStatus | null;

  @Column({ type: 'int', nullable: true })
  transitDays: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  why: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany('RouteSourceCheck', 'assessment')
  sources?: RouteSourceCheck[];
}
