import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns an ok health payload for the api service', () => {
    const health = controller.getHealth();

    expect(health.status).toBe('ok');
    expect(health.service).toBe('api');
    expect(health.timestamp).toEqual(expect.any(String));
  });
});
