import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnership } from '../common/utils/ownership.util';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: {
      productId: string;
      orderId: string;
      rating: number;
      comment?: string;
      tasteRating?: number;
      qualityRating?: number;
      valueRating?: number;
      packagingRating?: number;
      serviceRating?: number;
    },
    buyerId: string,
  ) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: dto.orderId },
    });
    assertOwnership(order.buyerId === buyerId, 'Not your order');
    if (order.status !== 'delivered')
      throw new BadRequestException('You can only review delivered orders');

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { orderId: dto.orderId, productId: dto.productId },
    });
    if (!orderItem)
      throw new BadRequestException('This product was not part of that order');

    const existing = await this.prisma.review.findUnique({
      where: {
        orderId_productId: { orderId: dto.orderId, productId: dto.productId },
      },
    });
    if (existing) throw new ConflictException('Already reviewed');

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
    });

    const review = await this.prisma.review.create({
      data: {
        productId: dto.productId,
        storeId: product.storeId,
        orderId: dto.orderId,
        buyerId,
        rating: dto.rating,
        comment: dto.comment,
        tasteRating: dto.tasteRating,
        qualityRating: dto.qualityRating,
        valueRating: dto.valueRating,
        packagingRating: dto.packagingRating,
        serviceRating: dto.serviceRating,
      },
    });

    await this.recomputeProductRating(dto.productId);
    await this.recomputeStoreRating(product.storeId);

    return review;
  }

  private async recomputeProductRating(productId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  }

  private async recomputeStoreRating(storeId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { storeId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.store.update({
      where: { id: storeId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  }

  findForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: { buyer: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForStore(storeId: string) {
    return this.prisma.review.findMany({
      where: { storeId },
      include: { buyer: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
