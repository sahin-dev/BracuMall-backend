/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function createService() {
  const tx = {
    review: {
      create: jest.fn().mockResolvedValue({ id: 'review-1', rating: 5 }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _avg: { rating: 5 }, _count: 1 }),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    product: { update: jest.fn() },
    store: { update: jest.fn() },
  };
  const prisma = {
    order: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        status: 'delivered',
      }),
    },
    orderItem: {
      findFirst: jest.fn().mockResolvedValue({ productName: 'Notebook' }),
    },
    review: {
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    product: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'product-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
      }),
    },
    publicUpload: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  return {
    service: new ReviewsService(prisma as any, notifications as any),
    prisma,
    tx,
    notifications,
  };
}

describe('ReviewsService', () => {
  it('creates a verified-purchase review, updates ratings, and notifies the seller', async () => {
    const { service, tx, notifications } = createService();

    await service.create(
      {
        productId: 'product-1',
        orderId: 'order-1',
        rating: 5,
        comment: ' Great ',
      },
      'buyer-1',
    );

    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ comment: 'Great' }),
      }),
    );
    expect(tx.product.update).toHaveBeenCalled();
    expect(tx.store.update).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      'seller-1',
      expect.objectContaining({ link: '/seller/reviews' }),
    );
  });

  it('rejects review images that are not owned review uploads', async () => {
    const { service, prisma, tx } = createService();
    prisma.publicUpload.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        {
          productId: 'product-1',
          orderId: 'order-1',
          rating: 5,
          images: ['/uploads/images/reviews/someone-elses-image.webp'],
        },
        'buyer-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('does not allow a buyer to mark their own review helpful', async () => {
    const { service, prisma, tx } = createService();
    tx.review.findUniqueOrThrow.mockResolvedValue({
      id: 'review-1',
      buyerId: 'buyer-1',
      helpfulUserIds: [],
    });

    await expect(
      service.toggleHelpful('review-1', 'buyer-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.review.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
