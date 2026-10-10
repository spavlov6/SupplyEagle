import type { AnalysisConfidence, AnalysisStatus } from '@supplyeagle/types';
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
import type { Supplier } from './supplier.entity.js';
import type { SupplierSourceCheck } from './supplier-source-check.entity.js';

@Entity('supplier_analyses')
export class SupplierAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne('Supplier', 'analyses', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  status: AnalysisStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  confidence: AnalysisConfidence | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  legalName: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @Column({ type: 'boolean', nullable: true })
  sanctionsHit: boolean | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  factsHash: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany('SupplierSourceCheck', 'analysis')
  sources?: SupplierSourceCheck[];
}
