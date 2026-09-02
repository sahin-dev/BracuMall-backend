/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { CategoryFilterType, ProductType, StoreMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from './products.service';

describe('ProductsService approved category capability', () => {
  const prisma = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    category: { findUniqueOrThrow: jest.fn() },
  };
  const stores = {
    findByOwner: jest.fn(),
  };
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.category.findUniqueOrThrow.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          name: where.id === 'food' ? 'Food' : where.id,
          slug: where.id,
          mode:
            where.id === 'food'
              ? StoreMode.food
              : where.id === 'mixed'
                ? StoreMode.hybrid
                : StoreMode.general,
          filterType:
            where.id === 'food'
              ? CategoryFilterType.food
              : CategoryFilterType.general,
        }),
    );
    service = new ProductsService(
      prisma as unknown as PrismaService,
      stores as unknown as StoresService,
    );
  });

  it('rejects food listings for a general category', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      ownerId: 'seller-1',
      mode: StoreMode.general,
      categoryId: 'electronics',
      categoryName: 'Electronics',
      isAdminManaged: false,
    });

    await expect(
      service.create({ productType: ProductType.food }, 'seller-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects general listings for a food category', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      ownerId: 'seller-1',
      mode: StoreMode.food,
      categoryId: 'food',
      categoryName: 'Food',
      isAdminManaged: false,
    });

    await expect(
      service.create({ productType: ProductType.general }, 'seller-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('derives a food listing and approved category when productType is omitted', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      ownerId: 'seller-1',
      mode: StoreMode.food,
      categoryId: 'food',
      categoryName: 'Food',
      isAdminManaged: false,
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
      ownerId: 'seller-1',
      mode: StoreMode.hybrid,
      categoryId: 'mixed',
      categoryName: 'Mixed',
      isAdminManaged: false,
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

  it('rejects pre-order on a non-admin-managed store', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      ownerId: 'seller-1',
      mode: StoreMode.general,
      categoryId: 'electronics',
      categoryName: 'Electronics',
      isAdminManaged: false,
    });

    await expect(
      service.create(
        { name: 'Gadget', price: 100, isPreOrder: true, preOrderPaymentType: 'postpaid' },
        'seller-1',
      ),
    ).rejects.toThrow('Pre-order is only available for admin-managed stores');
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('allows pre-order and stamps isAdminManaged on an admin-managed store', async () => {
    stores.findByOwner.mockResolvedValue({
      id: 'store-1',
      ownerId: 'admin-1',
      mode: StoreMode.general,
      categoryId: 'electronics',
      categoryName: 'Electronics',
      isAdminManaged: true,
    });
    prisma.product.create.mockResolvedValue({ id: 'product-1' });

    await service.create(
      { name: 'Gadget', price: 100, isPreOrder: true, preOrderPaymentType: 'postpaid' },
      'admin-1',
    );

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: 'admin-1',
        isAdminManaged: true,
        isPreOrder: true,
      }),
    });
  });

  it('builds category-specific food and clothing filters', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);

    await service.findAll({
      mealType: 'breakfast',
      cuisine: 'Bangladeshi',
      clothingType: 'tshirt',
      clothingAudience: 'unisex',
      size: 'm',
      color: 'Blue',
      inStock: 'true',
      hasDiscount: 'true',
      minRating: '4',
      withMeta: 'true',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mealType: 'breakfast',
          cuisine: { contains: 'Bangladeshi', mode: 'insensitive' },
          clothingType: 'tshirt',
          clothingAudience: 'unisex',
          sizes: { has: 'M' },
          colors: { has: 'blue' },
          stock: { gt: 0 },
          soldOutToday: false,
          discount: { gt: 0 },
          ratingAvg: { gte: 4 },
        }),
      }),
    );
  });

  it('rejects invalid category-specific enum filters', async () => {
    await expect(service.findAll({ mealType: 'brunch' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an invalid minimum rating filter', async () => {
    await expect(service.findAll({ minRating: 'excellent' })).rejects.toThrow(
      'Minimum rating must be between 0 and 5',
    );
  });

  it('rejects invalid price ranges before querying the database', async () => {
    await expect(
      service.findAll({ minPrice: '500', maxPrice: '100' }),
    ).rejects.toThrow('Minimum price cannot be greater than maximum price');
    await expect(service.findAll({ minPrice: 'free' })).rejects.toThrow(
      'Minimum price must be a valid number',
    );
  });

  it('rejects malformed enum and boolean filters', async () => {
    await expect(service.findAll({ productType: 'vehicle' })).rejects.toThrow(
      'Invalid product type',
    );
    await expect(service.findAll({ inStock: 'sometimes' })).rejects.toThrow(
      'Invalid in stock filter',
    );
  });
});
