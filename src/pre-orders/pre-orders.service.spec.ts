import { BadRequestException } from '@nestjs/common';
import { PreOrdersService } from './pre-orders.service';

describe('PreOrdersService payment-aware transitions', () => {
  const notifications = { create: jest.fn() };

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
    );

    await expect(
      service.cancelByBuyer('pre-order-1', 'buyer-1'),
    ).rejects.toThrow('deposit proof must be reviewed');
    expect(prisma.preOrder.update).not.toHaveBeenCalled();
  });
});
