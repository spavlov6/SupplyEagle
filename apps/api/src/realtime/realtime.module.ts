import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RedisService } from './redis.service.js';
import { RouteRedisService } from './route-redis.service.js';
import { SupplierGateway } from './supplier.gateway.js';

@Module({
  imports: [AuthModule],
  providers: [RedisService, RouteRedisService, SupplierGateway],
  exports: [RedisService, RouteRedisService],
})
export class RealtimeModule {}
