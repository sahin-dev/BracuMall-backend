import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../../common/utils/auth-cookies.util';

type AccessTokenPayload = {
  sub: string;
  tokenType: 'access' | 'refresh';
  sessionVersion?: number;
};

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof token === 'string' ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Cookie first (browser clients), falling back to a Bearer header so
      // Swagger's "Try it out" and non-browser API callers keep working.
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret', 'fallback-secret'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.tokenType !== 'access')
      throw new UnauthorizedException('Invalid access token');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { accessRole: true },
    });
    if (!user) return null;
    if (user.isSuspended) throw new UnauthorizedException('Account suspended');
    if (!user.isEmailVerified)
      throw new UnauthorizedException('Email not verified');
    if (
      Number(payload.sessionVersion ?? 0) !== Number(user.sessionVersion ?? 0)
    ) {
      throw new UnauthorizedException('Session expired');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isApproved: user.isApproved,
      isEmailVerified: Boolean(user.isEmailVerified),
      accessRole: user.accessRole
        ? { id: user.accessRole.id, name: user.accessRole.name, accountType: user.accessRole.accountType }
        : null,
      permissions: user.accessRole?.permissions ?? (user.role === 'admin' ? ['*'] : []),
    };
  }
}
