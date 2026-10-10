import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from '../analysis/entities/supplier.entity.js';
import { SupplierAnalysis } from '../analysis/entities/supplier-analysis.entity.js';
import { Route } from './entities/route.entity.js';
import { RouteAssessment } from './entities/route-assessment.entity.js';
import { RouteSourceCheck } from './entities/route-source-check.entity.js';
import { RouteSupplier } from './entities/route-supplier.entity.js';
import { PlaceLocation } from '../pipeline/entities/place-location.entity.js';
import { RouteDiscoveryRunner } from './route-discovery.runner.js';
import { RouteRedisService } from './route-redis.service.js';
import { RouteSummaryService } from './route-summary.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Route,
      RouteSupplier,
      RouteAssessment,
      RouteSourceCheck,
      Supplier,
      SupplierAnalysis,
      PlaceLocation,
    ]),
  ],
  providers: [RouteRedisService, RouteSummaryService, RouteDiscoveryRunner],
  exports: [RouteDiscoveryRunner, RouteRedisService],
})
export class RouteDiscoveryModule {}
