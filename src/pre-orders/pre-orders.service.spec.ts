import { BadRequestException } from '@nestjs/common';
import { PreOrdersService } from './pre-orders.service';

describe('PreOrdersService payment-aware transitions', () => {
  const notifications = { create: jest.fn() };
  const platformSettings = {
    getSettings: jest.fn().mockResolvedValue({ defaultPostpaidDepositPercent: 20 }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('keeps awaiting_payment reserved for submitted deposit proof', async () => {
    const prisma = {
      preOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'pre-order-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'pending',
        }),
        update: jest.fn(),
      },
    };
    const service = new PreOrdersService(
      prisma as any,
      notifications as any,
      platformSettings as any,
    );

    await expect(
      service.updateStatus(
        'pre-order-1',
        'awaiting_payment',
        'seller-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.preOrder.update).not.toHaveBeenCalled();
  });

  it('does not let a buyer cancel while deposit proof is under review', async () => {
    const prisma = {
      preOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'pre-order-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'awaiting_payment',
        }),
        update: jest.fn(),
      },
    };
    const service = new PreOrdersService(
      prisma as any,
      notifications as any,
      platformSettings as any,
    );

    await expect(
      service.cancelByBuyer('pre-order-1', 'buyer-1'),
    ).rejects.toThrow('deposit proof must be reviewed');
    expect(prisma.preOrder.update).not.toHaveBeenCalled();
  });

  it('resolves the postpaid deposit percent from product, then store, then platform default', async () => {
    const baseProduct = {
      id: 'product-1',
      isActive: true,
      isPreOrder: true,
      sellerId: 'seller-1',
      storeId: 'store-1',
      preOrderDeadline: null,
      preOrderPaymentType: 'postpaid',
      preOrderDepositAmount: null,
      preOrderLimit: null,
      price: 100,
    };

    const makePrisma = (productOverrides: Record<string, unknown>, store: unknown) => ({
      product: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseProduct, ...productOverrides }) },
      store: { findUnique: jest.fn().mockResolvedValue(store) },
      preOrder: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        aggregate: jest.fn(),
      },
    });

    // Product-level override wins over everything else.
    let prisma = makePrisma({ preOrderPostpaidDepositPercent: 40 }, { postpaidDepositPercent: 10 });
    let service = new PreOrdersService(prisma as any, notifications as any, platformSettings as any);
    let preOrder = await service.create({ productId: 'product-1', quantity: 2 }, 'buyer-1');
    expect(preOrder.depositAmount).toBe(80); // 100 * 2 * 40%

    // Store-level override wins when the product has none.
    prisma = makePrisma({ preOrderPostpaidDepositPercent: null }, { postpaidDepositPercent: 10 });
    service = new PreOrdersService(prisma as any, notifications as any, platformSettings as any);
    preOrder = await service.create({ productId: 'product-1', quantity: 2 }, 'buyer-1');
    expect(preOrder.depositAmount).toBe(20); // 100 * 2 * 10%

    // Falls back to the platform default when neither is set.
    prisma = makePrisma({ preOrderPostpaidDepositPercent: null }, { postpaidDepositPercent: null });
    service = new PreOrdersService(prisma as any, notifications as any, platformSettings as any);
    preOrder = await service.create({ productId: 'product-1', quantity: 2 }, 'buyer-1');
    expect(preOrder.depositAmount).toBe(40); // 100 * 2 * 20% (platform default)
  });
});
