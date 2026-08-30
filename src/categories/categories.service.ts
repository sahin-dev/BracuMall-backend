import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(dto: { name: string; slug: string; image?: string }) {
    return this.prisma.category.create({ data: dto });
  }

  findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
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
