import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoryFilterType, ProductType, StoreMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { resolveCategoryFilterType } from '../common/utils/category-filter.util';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        ...dto,
        filterType: resolveCategoryFilterType({
          name: dto.name,
          slug: dto.slug,
          mode: dto.mode || StoreMode.general,
          filterType: dto.filterType,
        }),
      },
    });
  }

  async findAll(query: any = {}) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    if (query.withCounts !== 'true' || categories.length === 0)
      return categories.map((category) => ({
        ...category,
        filterType: resolveCategoryFilterType(category),
      }));

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
      filterType: resolveCategoryFilterType(category),
      productCount: countByCategory.get(category.id) || 0,
    }));
  }

  async findAllAdmin() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map((category) => ({
      ...category,
      filterType: resolveCategoryFilterType(category),
    }));
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUniqueOrThrow({
      where: { id },
    });
    return this.prisma.$transaction(async (tx) => {
      const nextMode = dto.mode || existing.mode;
      const nextName = dto.name || existing.name;
      const nextSlug = dto.slug || existing.slug;
      const requestedFilterType =
        dto.filterType ??
        (dto.mode === StoreMode.food
          ? CategoryFilterType.food
          : existing.filterType);
      const category = await tx.category.update({
        where: { id },
        data: {
          ...dto,
          filterType: resolveCategoryFilterType({
            name: nextName,
            slug: nextSlug,
            mode: nextMode,
            filterType: requestedFilterType,
          }),
        },
      });
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
