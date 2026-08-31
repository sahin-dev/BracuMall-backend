import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductType, StoreMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  async findAll(query: any = {}) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    if (query.withCounts !== 'true' || categories.length === 0)
      return categories;

    const counts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: {
        isActive: true,
        categoryId: { in: categories.map((category) => category.id) },
      },
      _count: { _all: true },
    });
    const countByCategory = new Map(
      counts.map((entry) => [entry.categoryId, entry._count._all]),
    );
    return categories.map((category) => ({
      ...category,
      productCount: countByCategory.get(category.id) || 0,
    }));
  }

  findAllAdmin() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({ where: { id }, data: dto });
      const storeData: { categoryName?: string; mode?: StoreMode } = {};
      if (dto.name && dto.name !== existing.name)
        storeData.categoryName = dto.name;
      if (dto.mode && dto.mode !== existing.mode) storeData.mode = dto.mode;
      if (Object.keys(storeData).length > 0) {
        await tx.store.updateMany({
          where: { categoryId: id },
          data: storeData,
        });
      }
      if (dto.name && dto.name !== existing.name) {
        await tx.product.updateMany({
          where: { categoryId: id },
          data: { categoryName: dto.name },
        });
      }
      const requiredType = dto.mode ? this.requiredProductType(dto.mode) : null;
      if (requiredType) {
        await tx.product.updateMany({
          where: {
            categoryId: id,
            productType: { not: requiredType },
            isActive: true,
          },
          data: { isActive: false },
        });
      }
      return category;
    });
  }

  async remove(id: string) {
    await this.prisma.category.findUniqueOrThrow({ where: { id } });
    const stores = await this.prisma.store.count({ where: { categoryId: id } });
    if (stores > 0) {
      throw new BadRequestException(
        'Move assigned stores to another category before deleting this category',
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  private requiredProductType(mode: StoreMode): ProductType | null {
    if (mode === StoreMode.hybrid) return null;
    return mode === StoreMode.food ? ProductType.food : ProductType.general;
  }
}
