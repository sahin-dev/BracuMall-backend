import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

type CreateComplaintInput = {
  targetType: 'order' | 'product' | 'store' | 'user';
  targetId?: string;
  category?: string;
  severity?: string;
  occurrenceAt?: string;
  description: string;
  evidenceUrls?: string[];
};

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async resolveAgainstUserId(
    filedById: string,
    input: CreateComplaintInput,
  ): Promise<string> {
    if (input.targetType === 'order') {
      if (!input.targetId)
        throw new BadRequestException(
          'targetId is required for an order complaint',
        );
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: input.targetId },
      });
      if (order.buyerId === filedById) return order.sellerId;
      if (order.sellerId === filedById) return order.buyerId;
      throw new ForbiddenException('You are not part of this order');
    }
    if (input.targetType === 'product') {
      if (!input.targetId)
        throw new BadRequestException(
          'targetId is required for a product complaint',
        );
      const product = await this.prisma.product.findUniqueOrThrow({
        where: { id: input.targetId },
      });
      return product.sellerId;
    }
    if (input.targetType === 'store') {
      if (!input.targetId)
        throw new BadRequestException(
          'targetId is required for a store complaint',
        );
      const store = await this.prisma.store.findUniqueOrThrow({
        where: { id: input.targetId },
      });
      return store.ownerId;
    }
    // user
    if (!input.targetId)
      throw new BadRequestException(
        'targetId is required for a user complaint',
      );
    return input.targetId;
  }

  async create(input: CreateComplaintInput, filedById: string) {
    const againstUserId = await this.resolveAgainstUserId(filedById, input);
    if (againstUserId === filedById)
      throw new BadRequestException('Cannot file a complaint against yourself');

    const complaint = await this.prisma.complaint.create({
      data: {
        filedById,
        againstUserId,
        targetType: input.targetType as any,
        targetId: input.targetId,
        category: (input.category || 'other') as any,
        severity: (input.severity || 'low') as any,
        occurrenceAt: input.occurrenceAt
          ? new Date(input.occurrenceAt)
          : undefined,
        description: input.description,
        evidenceUrls: input.evidenceUrls ?? [],
      },
    });

    await this.notifications.create(againstUserId, {
      type: 'complaint_new',
      title: 'A complaint was filed against you',
      body: input.description.slice(0, 100),
      link: '/complaints',
    });
    await this.notifications.notifyAdmins({
      type: 'complaint_new',
      title: 'New complaint filed',
      body: input.description.slice(0, 100),
      link: '/admin/complaints',
    });

    return complaint;
  }

  findMine(userId: string) {
    return this.prisma.complaint.findMany({
      where: { OR: [{ filedById: userId }, { againstUserId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findAll(status?: string) {
    return this.prisma.complaint.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  async findById(id: string, userId: string, role: string) {
    const complaint = await this.prisma.complaint.findUniqueOrThrow({
      where: { id },
    });
    assertOwnership(
      role === 'admin' ||
        complaint.filedById === userId ||
        complaint.againstUserId === userId,
      'Not your complaint',
    );
    return complaint;
  }

  async updateStatus(
    id: string,
    dto: { status: string; resolution?: string },
    adminId: string,
  ) {
    const complaint = await this.prisma.complaint.findUniqueOrThrow({
      where: { id },
    });
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: dto.status as any,
        resolution: dto.resolution,
        resolvedBy: adminId,
        resolvedAt: ['resolved', 'dismissed'].includes(dto.status)
          ? new Date()
          : null,
      },
    });

    await this.notifications.createForMany(
      [complaint.filedById, complaint.againstUserId],
      {
        type: 'complaint_update',
        title: `Complaint ${dto.status}`,
        body: dto.resolution,
        link: '/complaints',
      },
    );

    return updated;
  }

  async respond(id: string, userId: string, response: string) {
    const complaint = await this.prisma.complaint.findUniqueOrThrow({
      where: { id },
    });
    assertOwnership(
      complaint.againstUserId === userId,
      'You cannot respond to this complaint',
    );
    if (['resolved', 'dismissed'].includes(complaint.status))
      throw new BadRequestException('This complaint is closed');
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: { response },
    });
    await this.notifications.notifyAdmins({
      type: 'complaint_update',
      title: 'A complaint received a response',
      link: '/admin/complaints',
    });
    return updated;
  }
}
