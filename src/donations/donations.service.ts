import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    });
  }

  findAll() {
    return this.prisma.donation.findMany({
      include: { donor: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
