import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { assertOwnership } from '../common/utils/ownership.util';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private events: EventsGateway,
  ) {}

  async getOrCreate(
    userId: string,
    otherUserId: string,
    contextType?: string,
    contextId?: string,
  ) {
    if (userId === otherUserId)
      throw new BadRequestException('Cannot message yourself');
    const [userAId, userBId] = [userId, otherUserId].sort();
    // contextType/contextId must be written as explicit null (not left unset) — Prisma's MongoDB
    // connector does not match `field: null` against a document where the field is genuinely
    // absent, only against one where it's explicitly null (verified: count()/findFirst() silently
    // return no match otherwise). Without this, getOrCreate never finds the existing conversation
    // and hits the unique index on the next create(), throwing a 500.
    const normalizedContextType = contextType ?? null;
    const normalizedContextId = contextId ?? null;
    const existing = await this.prisma.conversation.findFirst({
      where: {
        userAId,
        userBId,
        contextType: normalizedContextType,
        contextId: normalizedContextId,
      },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: {
        userAId,
        userBId,
        contextType: normalizedContextType,
        contextId: normalizedContextId,
      },
    });
  }

  async getOrCreateWithAdmin(userId: string) {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'admin' },
    });
    if (!admin) throw new NotFoundException('No admin available');
    return this.getOrCreate(userId, admin.id);
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    assertOwnership(
      conversation.userAId === userId || conversation.userBId === userId,
      'Not your conversation',
    );
    return conversation;
  }

  async findMine(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { lastMessageAt: 'desc' },
    });
    const otherIds = conversations.map((c) =>
      c.userAId === userId ? c.userBId : c.userAId,
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: otherIds } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return Promise.all(
      conversations.map(async (c) => {
        const otherId = c.userAId === userId ? c.userBId : c.userAId;
        const lastMessage = await this.prisma.message.findFirst({
          where: { conversationId: c.id },
          orderBy: { createdAt: 'desc' },
        });
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
            readAt: null,
          },
        });
        const other = userMap.get(otherId);
        return {
          ...c,
          otherUser: other
            ? { id: other.id, name: other.name, role: other.role }
            : null,
          lastMessage,
          unreadCount,
        };
      }),
    );
  }

  async getMessages(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(conversationId: string, userId: string, content: string) {
    const conversation = await this.assertParticipant(conversationId, userId);
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, content, readAt: null },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const otherId =
      conversation.userAId === userId
        ? conversation.userBId
        : conversation.userAId;
    const sender = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.notifications.create(otherId, {
      type: 'new_message',
      title: `New message from ${sender?.name ?? 'someone'}`,
      body: content.slice(0, 100),
      link: `/messages/${conversationId}`,
    });
    this.events.emitToUser(otherId, 'message', message);

    return message;
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
