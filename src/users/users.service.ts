import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'admin' },
    });
    if (!admin) {
      const email = this.config.get<string>('ADMIN_EMAIL');
      const password = this.config.get<string>('ADMIN_PASSWORD');
      if (!email || !password) {
        this.logger.warn('No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one.');
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      await this.prisma.user.create({
        data: {
          email: email.trim().toLowerCase(),
          name: 'Admin',
          password: hash,
          role: 'admin',
          isApproved: true,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      this.logger.log(`Initial admin account created for ${email}`);
    } else if (!admin.isEmailVerified) {
      await this.prisma.user.update({
        where: { id: admin.id },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      });
    }
  }

  create(data: {
    email: string;
    name: string;
    password: string;
    role?: string;
  }) {
    return this.prisma.user.create({
      data: { ...data, role: (data.role || 'buyer') as any },
    });
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((user) => this.withoutSecrets(user));
  }
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.withoutSecrets(user) : null;
  }
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
  update(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }
  approveSeller(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isApproved: true, role: 'seller' },
    });
  }

  async updateProfile(id: string, data: {
    name?: string;
    phone?: string;
    avatar?: string;
    studentId?: string;
    department?: string;
    preferredLocation?: string;
  }) {
    const updated = await this.prisma.user.update({ where: { id }, data });
    return this.withoutSecrets(updated);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    if (currentPassword === newPassword)
      throw new BadRequestException('New password must be different');
    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(newPassword, 12) },
    });
    return { success: true };
  }

  private withoutSecrets(user: any) {
    const {
      password: _password,
      emailOtpHash: _emailOtpHash,
      emailOtpExpiresAt: _emailOtpExpiresAt,
      emailOtpSentAt: _emailOtpSentAt,
      emailOtpAttempts: _emailOtpAttempts,
      failedLoginAttempts: _failedLoginAttempts,
      lockedUntil: _lockedUntil,
      ...safeUser
    } = user;
    return safeUser;
  }
}
