import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async create(userId: string, data: { type: string; title: string; body?: string; link?: string }) {
    const notification = await this.prisma.notification.create({
      data: { userId, ...data },
    });
    this.events.emitToUser(userId, 'notification', notification);
    return notification;
  }

  async createForMany(userIds: string[], data: { type: string; title: string; body?: string; link?: string }) {
    return Promise.all(userIds.map((userId) => this.create(userId, data)));
  }

  async notifyAdmins(data: { type: string; title: string; body?: string; link?: string }) {
    const admins = await this.prisma.user.findMany({ where: { role: 'admin' } });
    return this.createForMany(admins.map((a) => a.id), data);
  }

  findMine(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) return null;
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
