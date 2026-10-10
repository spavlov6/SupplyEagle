import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PipelineRedisService } from './pipeline-redis.service.js';
import { RedisService } from './redis.service.js';
import { RouteRedisService } from './route-redis.service.js';
import { SupplierGateway } from './supplier.gateway.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [
    RedisService,
    RouteRedisService,
    PipelineRedisService,
    SupplierGateway,
  ],
  exports: [RedisService, RouteRedisService, PipelineRedisService],
})
export class RealtimeModule {}
