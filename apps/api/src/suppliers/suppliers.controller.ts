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
  Supplier,
  SupplierDetailResponse,
  SupplierListResponse,
} from '@supplyeagle/types';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<SupplierListResponse> {
    return this.suppliersService.list(request.user.id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliersService.create(request.user.id, dto);
  }

  @Post(':id/reassess')
  @HttpCode(200)
  reassess(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetailResponse> {
    return this.suppliersService.reassess(request.user.id, id);
  }

  @Get(':id')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetailResponse> {
    return this.suppliersService.get(request.user.id, id);
  }
}
