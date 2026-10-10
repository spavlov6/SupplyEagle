import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Supplier } from '../suppliers/supplier.entity.js';
import type { Route } from './route.entity.js';

@Entity('route_suppliers')
@Unique('route_suppliers_route_id_supplier_id', ['routeId', 'supplierId'])
export class RouteSupplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  routeId: string;

  @ManyToOne('Route', 'links', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route?: Route;

  @Index()
  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;
}
