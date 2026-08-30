import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryLocationsService {
  constructor(private prisma: PrismaService) {}

  create(dto: { name: string; description?: string }) {
    return this.prisma.deliveryLocation.create({ data: dto });
  }

  findAll() {
    return this.prisma.deliveryLocation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findAllAdmin() {
    return this.prisma.deliveryLocation.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, dto: any) {
    await this.prisma.deliveryLocation.findUniqueOrThrow({ where: { id } });
    return this.prisma.deliveryLocation.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.deliveryLocation.findUniqueOrThrow({ where: { id } });
    return this.prisma.deliveryLocation.delete({ where: { id } });
  }
}
