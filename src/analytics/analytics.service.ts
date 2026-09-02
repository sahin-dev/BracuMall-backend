import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async recordVisit(visitorId: string) {
    await this.prisma.visitor.upsert({
      where: { visitorId },
      create: { visitorId },
      update: { visitCount: { increment: 1 }, lastSeenAt: new Date() },
    });
    return { success: true };
  }

  getTotalVisitors() {
    return this.prisma.visitor.count();
  }
}
