import { IsEmail, MinLength } from 'class-validator';
import type { RegisterRequest } from '@supplyeagle/types';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
