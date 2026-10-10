import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AnalysisModule } from '../src/analysis/analysis.module.js';
import { AppModule } from '../src/app.module.js';
import { PipelineModule } from '../src/pipeline/pipeline.module.js';
import { RouteDiscoveryModule } from '../src/route-discovery/route-discovery.module.js';

@Module({})
class EmptyAnalysisModule {}

@Module({})
class EmptyRouteModule {}

@Module({})
class EmptyPipelineModule {}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AnalysisModule)
      .useModule(EmptyAnalysisModule)
      .overrideModule(RouteDiscoveryModule)
      .useModule(EmptyRouteModule)
      .overrideModule(PipelineModule)
      .useModule(EmptyPipelineModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'agents',
      timestamp: expect.any(String),
    });
  });
});
