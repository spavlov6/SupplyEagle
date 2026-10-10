import {
  ConflictException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthResponse, AuthUser } from '@supplyeagle/types';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  DEFAULT_SCAN_HOUR,
  DEFAULT_SCAN_MINUTE,
  DEFAULT_SCAN_TIMEZONE,
} from '../pipeline/agents.js';
import { PipelineSchedule } from '../pipeline/entities/pipeline-schedule.entity.js';
import { PipelineRedisService } from '../realtime/pipeline-redis.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { User } from './user.entity.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @Optional()
    @InjectRepository(PipelineSchedule)
    private readonly schedules: Repository<PipelineSchedule> | null,
    private readonly jwt: JwtService,
    @Optional()
    private readonly pipelineEvents: PipelineRedisService | null,
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
    if (this.schedules) {
      await this.schedules.save(
        this.schedules.create({
          userId: user.id,
          enabled: true,
          hour: DEFAULT_SCAN_HOUR,
          minute: DEFAULT_SCAN_MINUTE,
          timezone: DEFAULT_SCAN_TIMEZONE,
          nextRunAt: null,
        }),
      );
    }
    if (this.pipelineEvents) {
      try {
        await this.pipelineEvents.publish({
          type: 'schedule.updated',
          userId: user.id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'schedule publish failed';
        this.logger.error(message);
      }
    }

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
