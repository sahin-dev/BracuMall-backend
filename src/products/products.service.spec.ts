/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { ProductType, StoreMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from './products.service';

describe('ProductsService approved category capability', () => {
  const prisma = {
    product: { create: jest.fn() },
  };
  const stores = {
    findByOwner: jest.fn(),
  };
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      prisma as unknown as PrismaService,
      stores as unknown as StoresService,
    );
  });

  it('rejects food listings for a general category', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      mode: StoreMode.general,
      categoryId: 'electronics',
      categoryName: 'Electronics',
    });

    await expect(
      service.create({ productType: ProductType.food }, 'seller-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects general listings for a food category', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      mode: StoreMode.food,
      categoryId: 'food',
      categoryName: 'Food',
    });

    await expect(
      service.create({ productType: ProductType.general }, 'seller-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('derives a food listing and approved category when productType is omitted', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      mode: StoreMode.food,
      categoryId: 'food',
      categoryName: 'Food',
    });
    prisma.product.create.mockResolvedValue({ id: 'product-1' });

    await service.create(
      { name: 'Lunch', price: 100, isPreOrder: false },
      'seller-1',
    );

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: 'seller-1',
        storeId: 'store-1',
        categoryId: 'food',
        categoryName: 'Food',
        productType: ProductType.food,
      }),
    });
  });

  it('allows either listing type only for an explicitly hybrid category', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      mode: StoreMode.hybrid,
      categoryId: 'mixed',
      categoryName: 'Mixed',
    });
    prisma.product.create.mockResolvedValue({ id: 'product-1' });

    await service.create(
      { name: 'Snack', price: 50, productType: ProductType.food },
      'seller-1',
    );

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ productType: ProductType.food }),
    });
  });
});
