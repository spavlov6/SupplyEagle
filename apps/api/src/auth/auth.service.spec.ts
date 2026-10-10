import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { User } from './user.entity.js';

const userId = '11111111-1111-1111-1111-111111111111';

describe('AuthService', () => {
  const users = {
    findOne: vi.fn(),
    create: vi.fn((value: Partial<User>) => value),
    save: vi.fn(),
  };
  const jwt = {
    sign: vi.fn(() => 'signed-token'),
  };

  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    users.save.mockImplementation(async (user: Partial<User>) => ({
      id: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...user,
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('registers a new user and returns a token', async () => {
    users.findOne.mockResolvedValue(null);

    const result = await service.register({
      email: 'Ada@Example.com',
      password: 'password1',
    });

    expect(users.create).toHaveBeenCalledWith({
      email: 'ada@example.com',
      passwordHash: expect.any(String),
    });
    const created = users.create.mock.calls[0]?.[0] as { passwordHash: string };
    expect(created.passwordHash).not.toBe('password1');
    expect(await compare('password1', created.passwordHash)).toBe(true);
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: userId,
      email: 'ada@example.com',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      user: { id: userId, email: 'ada@example.com' },
    });
  });

  it('rejects a duplicate email', async () => {
    users.findOne.mockResolvedValue({ id: userId, email: 'ada@example.com' });

    await expect(
      service.register({ email: 'ada@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('rejects a login with the wrong password', async () => {
    users.findOne.mockResolvedValue({
      id: userId,
      email: 'ada@example.com',
      passwordHash: await hash('password1', 10),
    });

    await expect(
      service.login({ email: 'ada@example.com', password: 'password2' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects a login for an unknown email', async () => {
    users.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs in with a matching password', async () => {
    users.findOne.mockResolvedValue({
      id: userId,
      email: 'ada@example.com',
      passwordHash: await hash('password1', 10),
    });

    const result = await service.login({
      email: 'ADA@example.com',
      password: 'password1',
    });

    expect(users.findOne).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      user: { id: userId, email: 'ada@example.com' },
    });
  });
});
