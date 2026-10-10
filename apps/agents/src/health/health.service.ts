import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@supplyeagle/types';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'agents',
      timestamp: new Date().toISOString(),
    };
  }
}
