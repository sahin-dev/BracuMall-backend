import { BadRequestException } from '@nestjs/common';
import { PaymentSubmissionsService } from './payment-submissions.service';

describe('PaymentSubmissionsService', () => {
  const baseDto = {
    orderId: 'order-1',
    sellerPaymentMethodId: 'method-1',
    amount: 500,
    transactionId: 'TX-123',
    paidAt: new Date().toISOString(),
    screenshotUrl: '/api/uploads/private/proof-1',
  };
  const notifications = { create: jest.fn(), notifyAdmins: jest.fn() };

  const makePrisma = () => ({
    order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'order-1', buyerId: 'buyer-1', sellerId: 'seller-1', storeId: 'store-1', total: 500, status: 'pending', paymentStatus: 'unpaid' }) },
    sellerPaymentMethod: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'method-1', storeId: 'store-1', label: 'bKash', isActive: true }) },
    paymentSubmission: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
  });

  beforeEach(() => jest.clearAllMocks());

  it('requires the proof amount to match the authoritative order total', async () => {
    const prisma = makePrisma();
    const service = new PaymentSubmissionsService(prisma as any, notifications as any);

    await expect(service.create({ ...baseDto, amount: 499 }, 'buyer-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a transaction ID already used with the same payment method', async () => {
    const prisma = makePrisma();
    prisma.paymentSubmission.findFirst.mockResolvedValueOnce({ id: 'existing-proof' } as any);
    const service = new PaymentSubmissionsService(prisma as any, notifications as any);

    await expect(service.create(baseDto, 'buyer-1')).rejects.toThrow('already been submitted');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not accept payment proof for a cancelled order', async () => {
    const prisma = makePrisma();
    prisma.order.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'order-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      storeId: 'store-1',
      total: 500,
      status: 'cancelled',
      paymentStatus: 'unpaid',
    } as any);
    const service = new PaymentSubmissionsService(
      prisma as any,
      notifications as any,
    );

    await expect(service.create(baseDto, 'buyer-1')).rejects.toThrow(
      'not accepting payments',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechecks order eligibility inside the transaction', async () => {
    const prisma = makePrisma();
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      preOrder: { updateMany: jest.fn() },
      paymentSubmission: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementationOnce((callback: any) => callback(tx));
    const service = new PaymentSubmissionsService(
      prisma as any,
      notifications as any,
    );

    await expect(service.create(baseDto, 'buyer-1')).rejects.toThrow(
      'no longer accepting payment proof',
    );
    expect(tx.paymentSubmission.create).not.toHaveBeenCalled();
  });

  it('reviewing a cancelled pre-order proof does not reopen the pre-order', async () => {
    const prisma = {
      paymentSubmission: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'proof-1',
          status: 'pending',
          preOrderId: 'pre-order-1',
          submittedBy: 'buyer-1',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'proof-1',
          status: 'verified',
        }),
      },
      preOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'pre-order-1',
          sellerId: 'seller-1',
          status: 'cancelled',
        }),
        update: jest.fn(),
      },
    };
    const service = new PaymentSubmissionsService(
      prisma as any,
      notifications as any,
    );

    await service.verify(
      'proof-1',
      { status: 'verified' },
      'seller-1',
      'seller',
    );

    expect(prisma.preOrder.update).not.toHaveBeenCalled();
    expect(prisma.paymentSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proof-1' },
        data: expect.objectContaining({ status: 'verified' }),
      }),
    );
  });
});
