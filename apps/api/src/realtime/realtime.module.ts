import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RedisService } from './redis.service.js';
import { SupplierGateway } from './supplier.gateway.js';

@Module({
  imports: [AuthModule],
  providers: [RedisService, SupplierGateway],
  exports: [RedisService],
})
export class RealtimeModule {}
