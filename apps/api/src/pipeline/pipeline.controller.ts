import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthUser,
  PipelineRun,
  PipelineRunListResponse,
  PipelineSchedule,
  PipelineStatusResponse,
} from '@supplyeagle/types';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PinClockDto } from './dto/pin-clock.dto.js';
import { PipelineService } from './pipeline.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('pipeline')
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get('status')
  status(
    @Req() request: AuthenticatedRequest,
  ): Promise<PipelineStatusResponse> {
    return this.pipeline.status(request.user.id);
  }

  @Get('runs')
  runs(@Req() request: AuthenticatedRequest): Promise<PipelineRunListResponse> {
    return this.pipeline.listRuns(request.user.id);
  }

  @Post('runs')
  @HttpCode(200)
  trigger(@Req() request: AuthenticatedRequest): Promise<PipelineRun> {
    return this.pipeline.trigger(request.user.id);
  }

  @Put('clock')
  pinClock(
    @Req() request: AuthenticatedRequest,
    @Body() dto: PinClockDto,
  ): Promise<PipelineSchedule> {
    return this.pipeline.pinLocalClock(request.user.id, dto.timezone);
  }
}
