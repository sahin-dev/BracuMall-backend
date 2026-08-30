import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  private async generateSlug(name: string) {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'store';

    let slug = base;
    let suffix = 1;
    while (await this.prisma.store.findUnique({ where: { slug } })) {
      slug = `${base}-${++suffix}`;
    }
    return slug;
  }

  async createForOwner(
    ownerId: string,
    name: string,
    sellingCategories: string[] = [],
  ) {
    const existing = await this.prisma.store.findUnique({ where: { ownerId } });
    if (existing) return existing;
    const slug = await this.generateSlug(name);
    return this.prisma.store.create({
      data: { ownerId, name, slug, sellingCategories },
    });
  }

  findAllActive() {
    return this.prisma.store.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findAllAdmin() {
    return this.prisma.store.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findBySlug(slug: string) {
    return this.prisma.store.findUniqueOrThrow({ where: { slug } });
  }

  findByOwner(ownerId: string) {
    return this.prisma.store.findUniqueOrThrow({ where: { ownerId } });
  }

  async updateByOwner(
    ownerId: string,
    dto: {
      name?: string;
      description?: string;
      logoUrl?: string;
      bannerUrl?: string;
      mode?: 'general' | 'food' | 'hybrid';
      location?: string;
      isOpen?: boolean;
      acceptsPickup?: boolean;
      acceptsDelivery?: boolean;
      minimumOrder?: number;
      deliveryFee?: number;
      prepTimeMin?: number;
      prepTimeMax?: number;
      openingHours?: any;
      foodSafetyNote?: string;
    },
  ) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) throw new NotFoundException('Store not found');
    return this.prisma.store.update({ where: { id: store.id }, data: dto });
  }

  async setActive(id: string, isActive: boolean) {
    await this.prisma.store.findUniqueOrThrow({ where: { id } });
    return this.prisma.store.update({ where: { id }, data: { isActive } });
  }

  async updateSellingCategoriesAdmin(id: string, categoryIds: string[]) {
    await this.prisma.store.findUniqueOrThrow({ where: { id } });
    return this.prisma.store.update({
      where: { id },
      data: { sellingCategories: categoryIds },
    });
  }

  async assertOwnerAndGetStore(storeId: string, ownerId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    assertOwnership(store.ownerId === ownerId, 'Not your store');
    return store;
  }
}
