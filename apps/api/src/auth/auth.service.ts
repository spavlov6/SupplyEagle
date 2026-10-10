import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthResponse, AuthUser } from '@supplyeagle/types';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { User } from './user.entity.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findOne({ where: { email } });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hash(dto.password, 10);
    const user = await this.users.save(
      this.users.create({ email, passwordHash }),
    );

    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    const passwordMatches = user
      ? await compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueToken(user);
  }

  private issueToken(user: User): AuthResponse {
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email }),
      user: this.toAuthUser(user),
    };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
    };
  }
}
