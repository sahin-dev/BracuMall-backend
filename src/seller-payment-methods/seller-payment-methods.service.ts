import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnership } from '../common/utils/ownership.util';

@Injectable()
export class SellerPaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  private async getOwnStore(ownerId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });
    if (!store) throw new NotFoundException('You do not have a store yet');
    return store;
  }

  async create(
    ownerId: string,
    dto: {
      label: string;
      type: string;
      accountInfo: string;
      instructions?: string;
    },
  ) {
    const store = await this.getOwnStore(ownerId);
    return this.prisma.sellerPaymentMethod.create({
      data: { ...dto, type: dto.type as any, storeId: store.id },
    });
  }

  async findMine(ownerId: string) {
    const store = await this.getOwnStore(ownerId);
    return this.prisma.sellerPaymentMethod.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForStore(storeId: string) {
    return this.prisma.sellerPaymentMethod.findMany({
      where: { storeId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOwnership(id: string, ownerId: string) {
    const method = await this.prisma.sellerPaymentMethod.findUniqueOrThrow({
      where: { id },
    });
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: method.storeId },
    });
    assertOwnership(store.ownerId === ownerId, 'Not your payment method');
    return method;
  }

  async update(id: string, dto: any, ownerId: string) {
    await this.assertOwnership(id, ownerId);
    return this.prisma.sellerPaymentMethod.update({ where: { id }, data: dto });
  }

  async remove(id: string, ownerId: string) {
    await this.assertOwnership(id, ownerId);
    return this.prisma.sellerPaymentMethod.delete({ where: { id } });
  }
}
