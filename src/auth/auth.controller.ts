import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from '../common/utils/auth-cookies.util';

type AuthResult = { access_token: string; refresh_token: string; user: unknown };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private respondWithSession(res: Response, result: AuthResult) {
    setAuthCookies(res, result);
    return { user: result.user };
  }

  @Post('register')
  @Throttle({
    default: { limit: 5, ttl: 15 * 60_000, blockDuration: 15 * 60_000 },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    return this.respondWithSession(res, result);
  }

  @Post('verify-email')
  @Throttle({
    default: { limit: 10, ttl: 10 * 60_000, blockDuration: 10 * 60_000 },
  })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyEmail(dto.email, dto.otp);
    return this.respondWithSession(res, result);
  }

  @Post('resend-email-otp')
  @Throttle({
    default: { limit: 3, ttl: 10 * 60_000, blockDuration: 10 * 60_000 },
  })
  @HttpCode(HttpStatus.OK)
  resendEmailOtp(@Body() dto: ResendEmailOtpDto) {
    return this.authService.resendEmailOtp(dto.email);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000, blockDuration: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) throw new UnauthorizedException('Invalid refresh token');
    const result = await this.authService.refreshToken(token);
    return this.respondWithSession(res, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user;
  }
}
