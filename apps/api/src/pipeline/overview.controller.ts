import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthUser, OverviewResponse } from '@supplyeagle/types';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OverviewService } from './overview.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<OverviewResponse> {
    return this.overview.get(request.user.id);
  }
}
