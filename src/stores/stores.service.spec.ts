/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ProductType, StoreMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from './stores.service';

describe('StoresService category changes', () => {
  it('derives store mode, moves products, and pauses incompatible listings', async () => {
    const tx = {
      store: {
        update: jest.fn().mockResolvedValue({
          id: 'store-1',
          categoryId: 'food',
          categoryName: 'Food',
          mode: StoreMode.food,
        }),
      },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      store: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'store-1' }),
      },
      category: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'food',
          name: 'Food',
          mode: StoreMode.food,
        }),
      },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => unknown) =>
          Promise.resolve(callback(tx)),
      ),
    };
    const service = new StoresService(prisma as unknown as PrismaService);

    await service.updateCategoryAdmin('store-1', 'food');

    expect(tx.store.update).toHaveBeenCalledWith({
      where: { id: 'store-1' },
      data: {
        categoryId: 'food',
        categoryName: 'Food',
        mode: StoreMode.food,
      },
    });
    expect(tx.product.updateMany).toHaveBeenNthCalledWith(1, {
      where: { storeId: 'store-1' },
      data: { categoryId: 'food', categoryName: 'Food' },
    });
    expect(tx.product.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        storeId: 'store-1',
        productType: { not: ProductType.food },
        isActive: true,
      },
      data: { isActive: false },
    });
  });
});

describe('StoresService.findAllActive', () => {
  it('filters by category and boosts admin-managed stores within the requested sort', async () => {
    const prisma = {
      store: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
    };
    const service = new StoresService(prisma as unknown as PrismaService);

    await service.findAllActive({ categoryId: 'food', sort: 'name:asc' });

    expect(prisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, categoryId: 'food' },
        orderBy: [{ isAdminManaged: 'desc' }, { name: 'asc' }],
      }),
    );
  });
});
