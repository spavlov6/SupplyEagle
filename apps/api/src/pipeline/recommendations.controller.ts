import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthUser,
  Recommendation,
  RecommendationListResponse,
} from '@supplyeagle/types';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  parseRecommendationStatus,
  RecommendationsService,
} from './recommendations.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status: string | undefined,
  ): Promise<RecommendationListResponse> {
    return this.recommendations.list(
      request.user.id,
      parseRecommendationStatus(status),
    );
  }

  @Get(':id')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Recommendation> {
    return this.recommendations.get(request.user.id, id);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Recommendation> {
    return this.recommendations.accept(request.user.id, id);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  dismiss(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Recommendation> {
    return this.recommendations.dismiss(request.user.id, id);
  }
}
