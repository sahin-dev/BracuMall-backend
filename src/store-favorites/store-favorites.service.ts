import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoreFavoritesService {
  constructor(private prisma: PrismaService) {}

  async add(dto: { storeId: string }, userId: string) {
    const existing = await this.prisma.storeFavorite.findFirst({
      where: { userId, storeId: dto.storeId },
    });
    if (existing) throw new ConflictException('Already favorited');
    return this.prisma.storeFavorite.create({ data: { ...dto, userId } });
  }

  findAll(userId: string) {
    return this.prisma.storeFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string) {
    const item = await this.prisma.storeFavorite.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Not found');
    return this.prisma.storeFavorite.delete({ where: { id } });
  }
}
