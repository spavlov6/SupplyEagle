import type {
  RouteSourceFacts,
  RouteSourceName,
  SourceCheckStatus,
} from '@supplyeagle/types';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { RouteAssessment } from './route-assessment.entity.js';

@Entity('route_source_checks')
export class RouteSourceCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  analysisId: string;

  @ManyToOne('RouteAssessment', 'sources', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysisId' })
  assessment?: RouteAssessment;

  @Column({ type: 'varchar', length: 32 })
  source: RouteSourceName;

  @Column({ type: 'varchar', length: 20 })
  status: SourceCheckStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  facts: RouteSourceFacts | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;
}
