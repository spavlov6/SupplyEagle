import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisModule } from './analysis/analysis.module.js';
import { HealthModule } from './health/health.module.js';
import { RouteDiscoveryModule } from './route-discovery/route-discovery.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    AnalysisModule,
    RouteDiscoveryModule,
  ],
})
export class AppModule {}
