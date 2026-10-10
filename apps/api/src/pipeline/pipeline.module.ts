import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { Route } from '../routes/route.entity.js';
import { RouteAssessment } from '../routes/route-assessment.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { SupplierAnalysis } from '../suppliers/supplier-analysis.entity.js';
import { AlertsService } from './alerts.service.js';
import { Alert } from './entities/alert.entity.js';
import { PlaceLocation } from './entities/place-location.entity.js';
import { PipelineRun } from './entities/pipeline-run.entity.js';
import { PipelineSchedule } from './entities/pipeline-schedule.entity.js';
import { PipelineStage } from './entities/pipeline-stage.entity.js';
import { Recommendation } from './entities/recommendation.entity.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';
import { PipelineController } from './pipeline.controller.js';
import { PipelineService } from './pipeline.service.js';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';

@Module({
  imports: [
    RealtimeModule,
    TypeOrmModule.forFeature([
      PipelineSchedule,
      PipelineRun,
      PipelineStage,
      PlaceLocation,
      Alert,
      Recommendation,
      Supplier,
      SupplierAnalysis,
      Route,
      RouteAssessment,
    ]),
  ],
  controllers: [
    PipelineController,
    RecommendationsController,
    OverviewController,
  ],
  providers: [
    PipelineService,
    AlertsService,
    RecommendationsService,
    OverviewService,
  ],
})
export class PipelineModule {}
