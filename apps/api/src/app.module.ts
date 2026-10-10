import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    AuthModule,
    RealtimeModule,
    SuppliersModule,
  ],
})
export class AppModule {}
