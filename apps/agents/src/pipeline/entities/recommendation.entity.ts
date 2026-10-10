import type {
  RecommendationPlan,
  RecommendationStatus,
  RecommendationType,
} from '@supplyeagle/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('recommendations')
export class RecommendationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  alertId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  runId: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: RecommendationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int' })
  priority: number;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: RecommendationStatus;

  @Column({ type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ type: 'uuid', nullable: true })
  routeId: string | null;

  @Column({ type: 'uuid', nullable: true })
  alternativeSupplierId: string | null;

  @Column({ type: 'uuid', nullable: true })
  alternativeRouteId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  plan: RecommendationPlan | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
