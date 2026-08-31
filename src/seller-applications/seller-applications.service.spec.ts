/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { ConflictException } from '@nestjs/common';
import { SellerApplicationsService } from './seller-applications.service';

const application = {
  id: 'application-1',
  userId: 'buyer-1',
  status: 'pending',
  legalName: 'Buyer One',
  dateOfBirth: new Date('2000-01-01'),
  gender: 'male',
  phoneNumber: '01700000000',
  whatsappNumber: '01700000000',
  studentId: '12345678',
  department: 'CSE',
  nidNumber: '1234567890',
  nidFrontUrl: '/api/uploads/private/aaaaaaaaaaaaaaaaaaaaaaaa',
  nidBackUrl: '/api/uploads/private/bbbbbbbbbbbbbbbbbbbbbbbb',
  studentIdUrl: '/api/uploads/private/cccccccccccccccccccccccc',
  presentAddress: 'Dhaka',
  permanentAddress: 'Dhaka',
  categoryId: 'category-1',
  categoryName: 'Books',
};

function createService(transitionCount = 1) {
  const tx = {
    sellerApplication: {
      updateMany: jest.fn().mockResolvedValue({ count: transitionCount }),
    },
    user: {
      update: jest.fn().mockResolvedValue({ id: 'buyer-1', name: 'Buyer One' }),
    },
    store: {},
  };
  const prisma = {
    sellerApplication: {
      findUnique: jest.fn().mockResolvedValue(application),
    },
    category: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'category-1',
        name: 'Books',
        mode: 'general',
        isActive: true,
      }),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const stores = {
    createForOwner: jest.fn().mockResolvedValue({ id: 'store-1' }),
  };
  const notifications = {
    create: jest.fn().mockResolvedValue({}),
    notifyAdmins: jest.fn(),
  };
  return {
    service: new SellerApplicationsService(
      prisma as any,
      stores as any,
      notifications as any,
    ),
    prisma,
    tx,
    stores,
    notifications,
  };
}

describe('SellerApplicationsService review', () => {
  const approval = {
    status: 'approved' as const,
    identityVerified: true,
    studentStatusVerified: true,
    addressVerified: true,
    contactVerified: true,
    documentsVerified: true,
  };

  it('promotes the user and creates the store inside the approval transaction', async () => {
    const { service, prisma, tx, stores, notifications } = createService();

    await service.review(application.id, approval, 'admin-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.sellerApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: application.id, status: 'pending' },
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'seller', isApproved: true }),
      }),
    );
    expect(stores.createForOwner).toHaveBeenCalledWith(
      'buyer-1',
      "Buyer One's Store",
      { categoryId: 'category-1', categoryName: 'Books', mode: 'general' },
      tx,
    );
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale concurrent decision before promoting the user', async () => {
    const { service, tx, stores, notifications } = createService(0);

    await expect(
      service.review(application.id, approval, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(stores.createForOwner).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
