import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { SupplierAnalysis } from '../analysis/entities/supplier-analysis.entity.js';
import { RouteAssessment } from '../route-discovery/entities/route-assessment.entity.js';
import { RouteDiscoveryModule } from '../route-discovery/route-discovery.module.js';
import { RefreshQueue } from './refresh.queue.js';
import { RefreshSubscriber } from './refresh.subscriber.js';
import { RefreshWorker } from './refresh.worker.js';

@Module({
  imports: [
    AnalysisModule,
    RouteDiscoveryModule,
    TypeOrmModule.forFeature([SupplierAnalysis, RouteAssessment]),
  ],
  providers: [RefreshQueue, RefreshWorker, RefreshSubscriber],
  exports: [RefreshQueue],
})
export class RefreshModule {}
