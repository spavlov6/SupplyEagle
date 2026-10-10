import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from '../analysis/entities/supplier.entity.js';
import { SupplierAnalysis } from '../analysis/entities/supplier-analysis.entity.js';
import { SupplierSourceCheck } from '../analysis/entities/supplier-source-check.entity.js';
import { RefreshModule } from '../refresh/refresh.module.js';
import { Route } from '../route-discovery/entities/route.entity.js';
import { RouteAssessment } from '../route-discovery/entities/route-assessment.entity.js';
import { RouteSourceCheck } from '../route-discovery/entities/route-source-check.entity.js';
import { AlertRecord } from './entities/alert.entity.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineSchedule } from './entities/pipeline-schedule.entity.js';
import { PipelineStageRecord } from './entities/pipeline-stage.entity.js';
import { RecommendationRecord } from './entities/recommendation.entity.js';
import { PipelineClaudeService } from './pipeline-claude.service.js';
import { PipelineRedisService } from './pipeline-redis.service.js';
import { PipelineScheduler } from './pipeline.scheduler.js';
import { ScanQueue } from './scan.queue.js';
import { ScanService } from './scan.service.js';
import { ScanWorker } from './scan.worker.js';

@Module({
  imports: [
    RefreshModule,
    TypeOrmModule.forFeature([
      PipelineSchedule,
      PipelineRun,
      PipelineStageRecord,
      AlertRecord,
      RecommendationRecord,
      Supplier,
      SupplierAnalysis,
      SupplierSourceCheck,
      Route,
      RouteAssessment,
      RouteSourceCheck,
    ]),
  ],
  providers: [
    PipelineRedisService,
    PipelineClaudeService,
    ScanQueue,
    ScanService,
    ScanWorker,
    PipelineScheduler,
  ],
})
export class PipelineModule {}
