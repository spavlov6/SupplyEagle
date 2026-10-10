import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { Supplier } from './supplier.entity.js';
import { SupplierAnalysis } from './supplier-analysis.entity.js';
import { SupplierSourceCheck } from './supplier-source-check.entity.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SupplierAnalysis, SupplierSourceCheck]),
    RealtimeModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
