/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService password recovery', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };
  const config = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('hashed-value' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  it('returns a generic response for an unknown email without writing reset state', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.forgotPassword(' Missing@Example.com '),
    ).resolves.toEqual({
      message:
        'If an eligible account exists, a password reset code has been sent',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'missing@example.com' },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('stores a short-lived reset code for a verified account', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'student@bracu.ac.bd',
      isEmailVerified: true,
      passwordResetOtpSentAt: null,
    });
    prisma.user.update.mockResolvedValue({});

    await service.forgotPassword('student@bracu.ac.bd');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordResetOtpHash: 'hashed-value',
        passwordResetOtpExpiresAt: expect.any(Date),
        passwordResetOtpSentAt: expect.any(Date),
        passwordResetOtpAttempts: 0,
      }),
    });
    consoleSpy.mockRestore();
  });

  it('resets the password, clears lock state, and invalidates old sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'student@bracu.ac.bd',
      isEmailVerified: true,
      passwordResetOtpHash: 'otp-hash',
      passwordResetOtpExpiresAt: new Date(Date.now() + 60_000),
      passwordResetOtpAttempts: 0,
    });
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.resetPassword('student@bracu.ac.bd', '123456', 'new-password'),
    ).resolves.toEqual({ message: 'Password reset successfully' });

    expect(mockedBcrypt.compare).toHaveBeenCalledWith('123456', 'otp-hash');
    expect(mockedBcrypt.hash).toHaveBeenCalledWith('new-password', 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        password: 'hashed-value',
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpSentAt: null,
        passwordResetOtpAttempts: 0,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      }),
    });
  });

  it('counts an invalid reset-code attempt', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isEmailVerified: true,
      passwordResetOtpHash: 'otp-hash',
      passwordResetOtpExpiresAt: new Date(Date.now() + 60_000),
      passwordResetOtpAttempts: 0,
    });
    mockedBcrypt.compare.mockResolvedValue(false as never);
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.resetPassword('student@bracu.ac.bd', '000000', 'new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordResetOtpAttempts: { increment: 1 } },
    });
  });

  it('rejects an expired reset code without changing the password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isEmailVerified: true,
      passwordResetOtpHash: 'otp-hash',
      passwordResetOtpExpiresAt: new Date(Date.now() - 1),
      passwordResetOtpAttempts: 0,
    });

    await expect(
      service.resetPassword('student@bracu.ac.bd', '123456', 'new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a refresh token issued before the password reset', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      tokenType: 'refresh',
      sessionVersion: 0,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isEmailVerified: true,
      isSuspended: false,
      sessionVersion: 1,
    });

    await expect(service.refreshToken('old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
