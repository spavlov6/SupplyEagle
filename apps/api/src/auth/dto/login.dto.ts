import { IsEmail, MinLength } from 'class-validator';
import type { LoginRequest } from '@supplyeagle/types';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
