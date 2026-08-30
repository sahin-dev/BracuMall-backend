import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

const donorSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

@Injectable()
export class DonationsService {
  constructor(private prisma: PrismaService) {}

  create(dto: { amount: number; message?: string }, donorId: string) {
    return this.prisma.donation.create({ data: { ...dto, donorId } });
  }

  findMine(donorId: string) {
    return this.prisma.donation.findMany({
      where: { donorId },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findAll() {
    return this.prisma.donation.findMany({
      include: { donor: { select: donorSelect } },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }
}
