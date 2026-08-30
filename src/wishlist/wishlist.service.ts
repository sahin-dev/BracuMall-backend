import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async add(
    dto: {
      productId: string;
      productName?: string;
      productImage?: string;
      productPrice?: number;
    },
    userId: string,
  ) {
    const existing = await this.prisma.wishlist.findFirst({
      where: { userId, productId: dto.productId },
    });
    if (existing) throw new ConflictException('Already in wishlist');
    return this.prisma.wishlist.create({ data: { ...dto, userId } });
  }

  findAll(userId: string) {
    return this.prisma.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string) {
    const item = await this.prisma.wishlist.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Not found');
    return this.prisma.wishlist.delete({ where: { id } });
  }
}
