import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const EMAIL_OTP_TTL_MINUTES = 10;
const EMAIL_OTP_RESEND_SECONDS = 60;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string,
    role: string = 'buyer',
  ) {
    email = this.normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = this.createOtp();
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role as any,
        emailOtpHash: await bcrypt.hash(otp, 10),
        emailOtpExpiresAt: this.otpExpiry(),
        emailOtpSentAt: new Date(),
        emailOtpAttempts: 0,
      },
    });
    await this.sendEmailOtp(user.email, otp);
    return this.verificationRequiredResponse(user.email);
  }

  async login(email: string, password: string) {
    email = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account is temporarily locked. Try again later');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.failedLoginAttempts || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    if (!user.isEmailVerified) {
      if (!user.emailOtpExpiresAt || user.emailOtpExpiresAt.getTime() < Date.now()) {
        await this.issueOtp(user);
      }
      throw new ForbiddenException(this.verificationRequiredResponse(user.email));
    }
    return this.generateTokens(user);
  }

  async verifyEmail(email: string, otp: string) {
    email = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid verification request');
    if (user.isEmailVerified) return this.generateTokens(user);
    if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
      throw new BadRequestException('Verification code not found');
    }
    if (user.emailOtpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code expired');
    }
    if (user.emailOtpAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new verification code');
    }
    const valid = await bcrypt.compare(otp, user.emailOtpHash);
    if (!valid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code');
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailOtpHash: null,
        emailOtpExpiresAt: null,
        emailOtpAttempts: 0,
      },
    });

    return this.generateTokens(verifiedUser);
  }

  async resendEmailOtp(email: string) {
    email = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid verification request');
    if (user.isEmailVerified) {
      return { message: 'Email already verified', emailVerified: true };
    }

    await this.issueOtp(user);
    return this.verificationRequiredResponse(user.email);
  }

  private generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign({ ...payload, tokenType: 'access' }),
      refresh_token: this.jwtService.sign(
        { ...payload, tokenType: 'refresh' },
        { expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '7d') as any },
      ),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved,
        isEmailVerified: Boolean(user.isEmailVerified),
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.tokenType !== 'refresh')
        throw new UnauthorizedException('Invalid refresh token');
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) throw new UnauthorizedException('User not found');
      if (!user.isEmailVerified) throw new UnauthorizedException('Email not verified');
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private createOtp() {
    return randomInt(100000, 1000000).toString();
  }

  private otpExpiry() {
    return new Date(Date.now() + EMAIL_OTP_TTL_MINUTES * 60 * 1000);
  }

  private async issueOtp(user: {
    id: string;
    email: string;
    emailOtpSentAt?: Date | null;
  }) {
    if (
      user.emailOtpSentAt &&
      Date.now() - user.emailOtpSentAt.getTime() < EMAIL_OTP_RESEND_SECONDS * 1000
    ) {
      throw new BadRequestException(
        `Wait ${EMAIL_OTP_RESEND_SECONDS} seconds before requesting another code`,
      );
    }
    const otp = this.createOtp();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtpHash: await bcrypt.hash(otp, 10),
        emailOtpExpiresAt: this.otpExpiry(),
        emailOtpSentAt: new Date(),
        emailOtpAttempts: 0,
      },
    });
    await this.sendEmailOtp(user.email, otp);
  }

  private verificationRequiredResponse(email: string) {
    return {
      requiresEmailVerification: true,
      email,
      message: 'Please verify your email before signing in',
    };
  }

  private async sendEmailOtp(email: string, otp: string) {
    const host = this.config.get<string>('SMTP_HOST');
    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('MAIL_FROM') ||
      this.config.get<string>('SMTP_USER');

    if (!host || !from) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        console.log(
          `[email-verification] SMTP is not configured. OTP for ${email}: ${otp}`,
        );
        return;
      }
      throw new ServiceUnavailableException('Email delivery is not configured');
    }

    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    const smtpSecure = this.config.get<string>('SMTP_SECURE');
    const secure =
      smtpSecure === 'true' ||
      smtpSecure === '1' ||
      port === 465;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Your BracUMan verification code',
        text: `Your BracUMan verification code is ${otp}. It expires in ${EMAIL_OTP_TTL_MINUTES} minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
            <h2 style="margin: 0 0 12px;">Verify your BracUMan account</h2>
            <p>Your verification code is:</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otp}</p>
            <p>This code expires in ${EMAIL_OTP_TTL_MINUTES} minutes.</p>
            <p>If you did not request this code, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('[email-verification] Failed to send OTP email', error);
      throw new ServiceUnavailableException('Could not send verification email');
    }
  }
}
