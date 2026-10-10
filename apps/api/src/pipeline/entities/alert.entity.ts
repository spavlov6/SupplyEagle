import type { AlertSeverity, AlertStatus, AlertType } from '@supplyeagle/types';
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

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 32 })
  type: AlertType;

  @Column({ type: 'varchar', length: 20 })
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: AlertStatus;

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

  @Index()
  @Column({ type: 'varchar', length: 160 })
  sourceKey: string;

  @Column({ type: 'uuid', nullable: true })
  recommendationId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  runId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
