import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductType, StoreMode, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  private async generateSlug(
    name: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'store';

    let slug = base;
    let suffix = 1;
    while (await db.store.findUnique({ where: { slug } })) {
      slug = `${base}-${++suffix}`;
    }
    return slug;
  }

  async createForOwner(
    ownerId: string,
    name: string,
    category: {
      categoryId: string;
      categoryName: string;
      mode: StoreMode;
    },
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const existing = await db.store.findUnique({ where: { ownerId } });
    if (existing) return existing;
    const slug = await this.generateSlug(name, db);
    return db.store.create({
      data: {
        ownerId,
        name,
        slug,
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        mode: category.mode,
      },
    });
  }

  async findAllActive(query: any = {}) {
    const where: any = { isActive: true };
    if (query.search) {
      where.OR = ['name', 'description', 'location'].map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
    }
    const allowedSortFields = new Set([
      'createdAt',
      'name',
      'ratingAvg',
      'ratingCount',
    ]);
    const [requestedField, requestedDirection] = String(
      query.sort || 'createdAt:desc',
    ).split(':');
    const sortField = allowedSortFields.has(requestedField)
      ? requestedField
      : 'createdAt';
    const take = Math.min(
      Math.max(Number(query.limit) || MAX_LIST_SIZE, 1),
      MAX_LIST_SIZE,
    );
    const skip = Math.max(Number(query.skip) || 0, 0);
    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        orderBy: { [sortField]: requestedDirection === 'asc' ? 'asc' : 'desc' },
        take,
        skip,
      }),
      query.withMeta === 'true'
        ? this.prisma.store.count({ where })
        : Promise.resolve(0),
    ]);

    let enrichedItems: Array<
      (typeof items)[number] & { productCount?: number }
    > = items;
    if (query.withCounts === 'true' && items.length > 0) {
      const counts = await this.prisma.product.groupBy({
        by: ['storeId'],
        where: {
          isActive: true,
          storeId: { in: items.map((store) => store.id) },
        },
        _count: { _all: true },
      });
      const countByStore = new Map(
        counts.map((entry) => [entry.storeId, entry._count._all]),
      );
      enrichedItems = items.map((store) => ({
        ...store,
        productCount: countByStore.get(store.id) || 0,
      }));
    }

    return query.withMeta === 'true'
      ? { items: enrichedItems, total, limit: take, skip }
      : enrichedItems;
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
      brandColor?: string;
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

  async updateCategoryAdmin(id: string, categoryId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id } });
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
    });
    return this.prisma.$transaction(async (tx) => {
      const updatedStore = await tx.store.update({
        where: { id },
        data: {
          categoryId: category.id,
          categoryName: category.name,
          mode: category.mode,
        },
      });
      await tx.product.updateMany({
        where: { storeId: store.id },
        data: { categoryId: category.id, categoryName: category.name },
      });
      const requiredType = this.requiredProductType(category.mode);
      if (requiredType) {
        await tx.product.updateMany({
          where: {
            storeId: store.id,
            productType: { not: requiredType },
            isActive: true,
          },
          data: { isActive: false },
        });
      }
      return updatedStore;
    });
  }

  private requiredProductType(mode: StoreMode): ProductType | null {
    if (mode === StoreMode.hybrid) return null;
    return mode === StoreMode.food ? ProductType.food : ProductType.general;
  }

  async assertOwnerAndGetStore(storeId: string, ownerId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    assertOwnership(store.ownerId === ownerId, 'Not your store');
    return store;
  }
}
