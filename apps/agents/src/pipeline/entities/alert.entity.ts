import type { AlertSeverity, AlertStatus, AlertType } from '@supplyeagle/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('alerts')
export class AlertRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

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

  @Column({ type: 'uuid', nullable: true })
  routeId: string | null;

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
