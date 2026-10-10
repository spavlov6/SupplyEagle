import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { PipelineModule } from '../src/pipeline/pipeline.module.js';
import { RealtimeModule } from '../src/realtime/realtime.module.js';
import { RedisService } from '../src/realtime/redis.service.js';
import { RoutesModule } from '../src/routes/routes.module.js';
import { SuppliersModule } from '../src/suppliers/suppliers.module.js';

@Module({})
class EmptyAuthModule {}

@Module({})
class EmptySuppliersModule {}

@Module({})
class EmptyRoutesModule {}

@Module({})
class EmptyPipelineModule {}

@Module({
  providers: [
    {
      provide: RedisService,
      useValue: {
        publish: async () => undefined,
        listen: async () => undefined,
      },
    },
  ],
  exports: [RedisService],
})
class FakeRealtimeModule {}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AuthModule)
      .useModule(EmptyAuthModule)
      .overrideModule(SuppliersModule)
      .useModule(EmptySuppliersModule)
      .overrideModule(RoutesModule)
      .useModule(EmptyRoutesModule)
      .overrideModule(RealtimeModule)
      .useModule(FakeRealtimeModule)
      .overrideModule(PipelineModule)
      .useModule(EmptyPipelineModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('GET /health', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'api',
      timestamp: expect.any(String),
    });
  });
});
