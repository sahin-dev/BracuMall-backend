import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformPaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  create(dto: {
    label: string;
    type: string;
    accountInfo: string;
    instructions?: string;
  }) {
    return this.prisma.platformPaymentMethod.create({
      data: { ...dto, type: dto.type as any },
    });
  }

  findActive() {
    return this.prisma.platformPaymentMethod.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll() {
    return this.prisma.platformPaymentMethod.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: any) {
    await this.prisma.platformPaymentMethod.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.platformPaymentMethod.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.prisma.platformPaymentMethod.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.platformPaymentMethod.delete({ where: { id } });
  }
}
