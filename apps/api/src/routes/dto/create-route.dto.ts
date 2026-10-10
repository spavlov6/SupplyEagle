import type { CreateRouteRequest, ShippingMode } from '@supplyeagle/types';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateRouteDto implements CreateRouteRequest {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  origin: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  destination: string;

  @IsIn(['air', 'sea'])
  mode: ShippingMode;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  supplierIds: string[];
}
