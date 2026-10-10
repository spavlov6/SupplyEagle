import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisRunner } from './analysis.runner.js';
import { AnalysisSubscriber } from './analysis.subscriber.js';
import { ClaudeService } from './claude.service.js';
import { Supplier } from './entities/supplier.entity.js';
import { SupplierAnalysis } from './entities/supplier-analysis.entity.js';
import { SupplierSourceCheck } from './entities/supplier-source-check.entity.js';
import { RedisService } from './redis.service.js';
import { SourceClient } from './source.client.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Supplier, SupplierAnalysis, SupplierSourceCheck]),
  ],
  providers: [
    RedisService,
    SourceClient,
    ClaudeService,
    AnalysisRunner,
    AnalysisSubscriber,
  ],
})
export class AnalysisModule {}
