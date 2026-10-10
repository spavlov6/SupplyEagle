import type { ShippingMode } from '@supplyeagle/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { RouteAssessment } from './route-assessment.entity.js';
import type { RouteSupplier } from './route-supplier.entity.js';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  origin: string;

  @Column({ type: 'varchar', length: 200 })
  destination: string;

  @Column({ type: 'varchar', length: 8 })
  mode: ShippingMode;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany('RouteSupplier', 'route')
  links?: RouteSupplier[];

  @OneToMany('RouteAssessment', 'route')
  assessments?: RouteAssessment[];
}
