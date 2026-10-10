import type {
  SourceCheckStatus,
  SourceFacts,
  SourceName,
} from '@supplyeagle/types';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { SupplierAnalysis } from './supplier-analysis.entity.js';

@Entity('supplier_source_checks')
export class SupplierSourceCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  analysisId: string;

  @ManyToOne('SupplierAnalysis', 'sources', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysisId' })
  analysis?: SupplierAnalysis;

  @Column({ type: 'varchar', length: 32 })
  source: SourceName;

  @Column({ type: 'varchar', length: 20 })
  status: SourceCheckStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  facts: SourceFacts | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;
}
