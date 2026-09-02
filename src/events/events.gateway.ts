import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { parse as parseCookies } from 'cookie';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../common/utils/auth-cookies.util';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  // Live "who's on the site" presence. Keyed by socket id -> the visitor id
  // the client sends in its handshake, so multiple tabs from the same
  // browser count once. Anonymous browsers are tracked here too (they just
  // never join a `user:*` room) — this map is intentionally separate from
  // authentication so a guest still shows up in the online count.
  private readonly presence = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {};
      const token = cookies[ACCESS_TOKEN_COOKIE] || (client.handshake.auth?.token as string);
      if (!token) throw new Error('No token');
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('jwt.secret', 'fallback-secret'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.isSuspended) throw new Error('Unauthorized');
      client.data.userId = user.id;
      client.join(`user:${user.id}`);
    } catch {
      // No/invalid session — still allow the connection through for presence
      // tracking (a logged-out visitor is still "on the site"), just without
      // a user room to receive private notifications in.
    }
    const visitorId = (client.handshake.auth?.visitorId as string) || client.id;
    this.presence.set(client.id, visitorId);
    this.broadcastOnlineCount();
  }

  handleDisconnect(client: Socket) {
    this.presence.delete(client.id);
    this.broadcastOnlineCount();
  }

  getOnlineCount() {
    return new Set(this.presence.values()).size;
  }

  private broadcastOnlineCount() {
    this.server?.emit('presence:count', this.getOnlineCount());
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
