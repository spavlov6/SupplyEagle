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
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/user.entity.js';
import { Route } from '../../routes/route.entity.js';
import { Supplier } from '../../suppliers/supplier.entity.js';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

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

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier | null;

  @Column({ type: 'uuid', nullable: true })
  routeId: string | null;

  @ManyToOne(() => Route, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'routeId' })
  route?: Route | null;

  @Column({ type: 'uuid', nullable: true })
  alternativeSupplierId: string | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'alternativeSupplierId' })
  alternativeSupplier?: Supplier | null;

  @Column({ type: 'uuid', nullable: true })
  alternativeRouteId: string | null;

  @ManyToOne(() => Route, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'alternativeRouteId' })
  alternativeRoute?: Route | null;

  @Column({ type: 'jsonb', nullable: true })
  plan: RecommendationPlan | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
