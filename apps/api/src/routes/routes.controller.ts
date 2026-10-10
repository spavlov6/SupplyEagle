import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthUser,
  RouteDetailResponse,
  RouteListItem,
  RouteListResponse,
} from '@supplyeagle/types';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RoutesService } from './routes.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<RouteListResponse> {
    return this.routesService.list(request.user.id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateRouteDto,
  ): Promise<RouteListItem> {
    return this.routesService.create(request.user.id, dto);
  }

  @Post(':id/reassess')
  @HttpCode(200)
  reassess(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RouteDetailResponse> {
    return this.routesService.reassess(request.user.id, id);
  }

  @Get(':id')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RouteDetailResponse> {
    return this.routesService.get(request.user.id, id);
  }
}
