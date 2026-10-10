import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  Supplier as SupplierResponse,
  SupplierListResponse,
} from '@supplyeagle/types';
import { Repository } from 'typeorm';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { Supplier } from './supplier.entity.js';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
  ) {}

  async list(userId: string): Promise<SupplierListResponse> {
    const rows = await this.suppliers.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      suppliers: rows.map((row) => this.toResponse(row)),
    };
  }

  async create(
    userId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierResponse> {
    const saved = await this.suppliers.save(
      this.suppliers.create({
        userId,
        name: dto.name,
        country: null,
      }),
    );

    return this.toResponse(saved);
  }

  private toResponse(row: Supplier): SupplierResponse {
    return {
      id: row.id,
      name: row.name,
      country: row.country ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
