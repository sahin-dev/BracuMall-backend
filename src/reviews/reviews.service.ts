import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

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
      images?: string[];
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

    await this.assertOwnedReviewImages(buyerId, dto.images ?? []);

    const existing = await this.prisma.review.findUnique({
      where: {
        orderId_productId: { orderId: dto.orderId, productId: dto.productId },
      },
    });
    if (existing) throw new ConflictException('Already reviewed');

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
    });
    if (
      product.storeId !== order.storeId ||
      product.sellerId !== order.sellerId
    ) {
      throw new BadRequestException('Product and order seller do not match');
    }

    let review;
    try {
      review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            productId: dto.productId,
            storeId: product.storeId,
            orderId: dto.orderId,
            buyerId,
            rating: dto.rating,
            comment: dto.comment?.trim() || undefined,
            tasteRating: dto.tasteRating,
            qualityRating: dto.qualityRating,
            valueRating: dto.valueRating,
            packagingRating: dto.packagingRating,
            serviceRating: dto.serviceRating,
            images: dto.images ?? [],
          },
        });
        await this.recomputeProductRating(dto.productId, tx);
        await this.recomputeStoreRating(product.storeId, tx);
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Already reviewed');
      }
      throw error;
    }

    await this.notifications.create(product.sellerId, {
      type: 'review_received',
      title: `New ${dto.rating}-star review`,
      body: orderItem.productName,
      link: '/seller/reviews',
    });

    return review;
  }

  private async recomputeProductRating(
    productId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const agg = await db.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    await db.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  }

  private async recomputeStoreRating(
    storeId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const agg = await db.review.aggregate({
      where: { storeId },
      _avg: { rating: true },
      _count: true,
    });
    await db.store.update({
      where: { id: storeId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  }

  findForProduct(productId: string, skip = 0, take = MAX_LIST_SIZE) {
    return this.prisma.review.findMany({
      where: { productId },
      include: { buyer: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  findForStore(storeId: string, skip = 0, take = MAX_LIST_SIZE) {
    return this.prisma.review.findMany({
      where: { storeId },
      include: { buyer: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async statsForStore(storeId: string) {
    const [ratings, subratings] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { storeId },
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { storeId },
        _avg: {
          tasteRating: true,
          qualityRating: true,
          valueRating: true,
          packagingRating: true,
          serviceRating: true,
        },
        _count: true,
      }),
    ]);
    return {
      total: subratings._count,
      breakdown: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count:
          ratings.find((entry) => entry.rating === rating)?._count._all || 0,
      })),
      averages: subratings._avg,
    };
  }

  async findForOwner(ownerId: string) {
    const store = await this.prisma.store.findFirstOrThrow({
      where: { ownerId },
    });
    const reviews = await this.prisma.review.findMany({
      where: { storeId: store.id },
      include: { buyer: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: [...new Set(reviews.map((review) => review.productId))] },
      },
      select: { id: true, name: true },
    });
    const productNames = new Map(
      products.map((product) => [product.id, product.name]),
    );
    return reviews.map((review) => ({
      ...review,
      productName: productNames.get(review.productId) || 'Deleted product',
    }));
  }

  async toggleHelpful(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUniqueOrThrow({ where: { id } });
      if (review.buyerId === userId) {
        throw new BadRequestException(
          'You cannot mark your own review as helpful',
        );
      }
      const alreadyMarked = review.helpfulUserIds.includes(userId);
      const changed = await tx.review.updateMany({
        where: alreadyMarked
          ? { id, helpfulUserIds: { has: userId } }
          : { id, NOT: { helpfulUserIds: { has: userId } } },
        data: alreadyMarked
          ? {
              helpfulUserIds: {
                set: review.helpfulUserIds.filter((uid) => uid !== userId),
              },
              helpfulCount: { decrement: 1 },
            }
          : {
              helpfulUserIds: { push: userId },
              helpfulCount: { increment: 1 },
            },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Helpful state changed; please try again');
      }
      return tx.review.findUniqueOrThrow({ where: { id } });
    });
  }

  async reply(id: string, ownerId: string, message: string) {
    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id },
    });
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: review.storeId },
    });
    assertOwnership(store.ownerId === ownerId, 'Not your store');
    if (!message.trim()) throw new BadRequestException('Reply cannot be empty');
    return this.prisma.review.update({
      where: { id },
      data: { sellerReply: message.trim(), sellerRepliedAt: new Date() },
    });
  }

  private async assertOwnedReviewImages(userId: string, urls: string[]) {
    if (urls.length === 0) return;
    const uploads = await this.prisma.publicUpload.findMany({
      where: {
        ownerId: userId,
        purpose: 'review_image',
        url: { in: urls },
      },
      select: { url: true },
    });
    if (uploads.length !== urls.length) {
      throw new BadRequestException(
        'Every review image must be uploaded by the reviewer',
      );
    }
  }
}
