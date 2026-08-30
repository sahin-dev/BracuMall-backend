import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const notifications = { create: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('rejects access from a user who is neither buyer nor seller', async () => {
    const prisma = {
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          items: [],
        }),
      },
    };
    const service = new OrdersService(prisma as any, notifications as any);

    await expect(service.findById('order-1', 'other-user', 'buyer')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an invalid order status transition before writing', async () => {
    const prisma = {
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'pending',
          inventoryRestored: false,
          items: [],
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new OrdersService(prisma as any, notifications as any);

    await expect(service.updateStatus('order-1', { status: 'delivered' }, 'seller-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses current product prices and reserves stock in one transaction', async () => {
    const createdOrder = { id: 'order-1', sellerId: 'seller-1', total: 220, items: [{ id: 'item-1' }] };
    const tx = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      order: { create: jest.fn().mockResolvedValue(createdOrder) },
    };
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'product-1',
          name: 'Meal box',
          price: 100,
          stock: 5,
          isActive: true,
          isPreOrder: false,
          soldOutToday: false,
          sellerId: 'seller-1',
          storeId: 'store-1',
          images: [],
          productType: 'food',
        }]),
      },
      store: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'store-1',
          acceptsPickup: true,
          acceptsDelivery: true,
          deliveryFee: 20,
          minimumOrder: null,
          isActive: true,
          mode: 'general',
          isOpen: true,
          openingHours: null,
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OrdersService(prisma as any, notifications as any);

    await service.create({
      items: [{ productId: 'product-1', quantity: 2 }],
      deliveryLocation: 'Campus gate',
      fulfillmentType: 'delivery',
    }, 'buyer-1');

    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'product-1', stock: { gte: 2 } }),
      data: { stock: { decrement: 2 } },
    }));
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ total: 220, sellerId: 'seller-1' }),
    }));
  });
});
