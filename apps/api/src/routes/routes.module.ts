import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { Route } from './route.entity.js';
import { RouteAssessment } from './route-assessment.entity.js';
import { RouteSourceCheck } from './route-source-check.entity.js';
import { RouteSupplier } from './route-supplier.entity.js';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Route,
      RouteSupplier,
      RouteAssessment,
      RouteSourceCheck,
      Supplier,
    ]),
    RealtimeModule,
  ],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
