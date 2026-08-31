import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: { name: string; slug: string; image?: string }) {
    return this.prisma.category.create({ data: dto });
  }

  async findAll(query: any = {}) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    if (query.withCounts !== 'true' || categories.length === 0) return categories;

    const counts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { isActive: true, categoryId: { in: categories.map((category) => category.id) } },
      _count: { _all: true },
    });
    const countByCategory = new Map(counts.map((entry) => [entry.categoryId, entry._count._all]));
    return categories.map((category) => ({ ...category, productCount: countByCategory.get(category.id) || 0 }));
  }

  findAllAdmin() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, dto: any) {
    await this.prisma.category.findUniqueOrThrow({ where: { id } });
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.category.findUniqueOrThrow({ where: { id } });
    return this.prisma.category.delete({ where: { id } });
  }
}
