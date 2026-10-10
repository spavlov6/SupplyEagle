import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateSupplierRequest } from '@supplyeagle/types';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateSupplierDto implements CreateSupplierRequest {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;
}
