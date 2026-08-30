import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret', 'fallback-secret'),
    });
  }

  async validate(payload: any) {
    if (payload.tokenType !== 'access')
      throw new UnauthorizedException('Invalid access token');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) return null;
    if (user.isSuspended) throw new UnauthorizedException('Account suspended');
    if (!user.isEmailVerified) throw new UnauthorizedException('Email not verified');
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isApproved: user.isApproved,
      isEmailVerified: Boolean(user.isEmailVerified),
    };
  }
}
