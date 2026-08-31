import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductType, StoreMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private storesService: StoresService,
  ) {}

  async create(dto: any, sellerId: string) {
    const store = await this.storesService.findByOwner(sellerId);
    const productType = this.defaultProductType(store.mode, dto.productType);
    this.assertProductTypeAllowed(store.mode, productType);
    if (productType === ProductType.food && dto.menuId) {
      await this.assertMenuOwnership(store.id, dto.menuId);
    }
    const nextProduct = { ...dto, productType };
    const preOrderSettings = this.normalizePreOrderSettings(nextProduct);
    const productSettings = this.normalizeProductSettings(nextProduct);
    return this.prisma.product.create({
      data: {
        ...nextProduct,
        ...preOrderSettings,
        ...productSettings,
        sellerId,
        storeId: store.id,
        // A product always sells under its store's one category — never
        // client-selectable, so it can't drift from what the store was
        // approved to sell.
        categoryId: store.categoryId,
        categoryName: store.categoryName,
      },
    });
  }

  async findAll(query: any = {}) {
    const where: any = { isActive: true };
    if (query.search) {
      where.OR = [
        'name',
        'description',
        'categoryName',
        'menuSection',
        'ingredients',
      ].map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.storeId) where.storeId = query.storeId;
    if (query.minPrice)
      where.price = { ...where.price, gte: Number(query.minPrice) };
    if (query.maxPrice)
      where.price = { ...where.price, lte: Number(query.maxPrice) };
    if (query.isPreOrder) where.isPreOrder = query.isPreOrder === 'true';
    if (query.productType) where.productType = query.productType;
    if (query.condition) where.condition = query.condition;
    if (query.isNegotiable) where.isNegotiable = query.isNegotiable === 'true';
    if (query.dietaryTag) where.dietaryTags = { has: query.dietaryTag };
    if (query.availableDay) where.availableDays = { has: query.availableDay };
    if (query.excludeSoldOut === 'true') where.soldOutToday = false;
    if (query.sellerId) where.sellerId = query.sellerId;
    const allowedSortFields = new Set([
      'createdAt',
      'price',
      'ratingAvg',
      'totalSold',
      'name',
    ]);
    const [requestedSortField, requestedSortDirection] = String(
      query.sort || 'createdAt:desc',
    ).split(':');
    const sortField = allowedSortFields.has(requestedSortField)
      ? requestedSortField
      : 'createdAt';
    const orderBy: any = {
      [sortField]: requestedSortDirection === 'asc' ? 'asc' : 'desc',
    };
    const take = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = Math.max(Number(query.skip) || 0, 0);
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        take,
        skip,
      }),
      query.withMeta === 'true'
        ? this.prisma.product.count({ where })
        : Promise.resolve(0),
    ]);
    return query.withMeta === 'true'
      ? { items, total, limit: take, skip }
      : items;
  }

  findById(id: string) {
    return this.prisma.product.findUniqueOrThrow({ where: { id } });
  }

  async update(id: string, dto: any, sellerId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    assertOwnership(product.sellerId === sellerId, 'Not your product');
    const store = await this.storesService.findByOwner(sellerId);
    const nextProductType = dto.productType ?? product.productType;
    this.assertProductTypeAllowed(store.mode, nextProductType);
    if (nextProductType === 'food' && dto.menuId) {
      await this.assertMenuOwnership(store.id, dto.menuId);
    }
    const nextProduct = { ...product, ...dto };
    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        ...this.normalizePreOrderSettings(nextProduct),
        ...this.normalizeProductSettings(nextProduct),
        // A product's category always mirrors its store's single category —
        // never editable per product, even if a stale value is sent.
        categoryId: store.categoryId,
        categoryName: store.categoryName,
      },
    });
  }

  async remove(id: string, sellerId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    assertOwnership(product.sellerId === sellerId, 'Not your product');
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  findBySeller(sellerId: string) {
    return this.prisma.product.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findAllAdmin() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  async setActiveByAdmin(id: string, isActive: boolean) {
    await this.prisma.product.findUniqueOrThrow({ where: { id } });
    return this.prisma.product.update({ where: { id }, data: { isActive } });
  }

  private normalizePreOrderSettings(dto: any) {
    if (!dto.isPreOrder) {
      return {
        preOrderDeadline: null,
        preOrderPaymentType: 'postpaid',
        preOrderDepositAmount: null,
        preOrderLimit: null,
      };
    }

    const paymentType = dto.preOrderPaymentType || 'postpaid';
    if (paymentType === 'prepaid') {
      const depositAmount = Number(dto.preOrderDepositAmount);
      if (!depositAmount || depositAmount <= 0) {
        throw new BadRequestException(
          'preOrderDepositAmount is required for prepaid pre-order products',
        );
      }
      if (depositAmount > Number(dto.price)) {
        throw new BadRequestException(
          'preOrderDepositAmount cannot be greater than product price',
        );
      }
    }
    return {
      preOrderDeadline: dto.preOrderDeadline
        ? new Date(dto.preOrderDeadline)
        : null,
      preOrderPaymentType: paymentType,
      preOrderDepositAmount:
        paymentType === 'prepaid' ? Number(dto.preOrderDepositAmount) : null,
      preOrderLimit: dto.preOrderLimit ? Number(dto.preOrderLimit) : null,
    };
  }

  private defaultProductType(storeMode: StoreMode, productType?: ProductType) {
    if (productType) return productType;
    return storeMode === StoreMode.food
      ? ProductType.food
      : ProductType.general;
  }

  private assertProductTypeAllowed(
    storeMode: StoreMode,
    productType: ProductType,
  ) {
    if (storeMode === StoreMode.hybrid || storeMode === productType) return;
    throw new BadRequestException(
      `Your approved category only allows ${storeMode} products`,
    );
  }

  private async assertMenuOwnership(storeId: string, menuId: string) {
    const menu = await this.prisma.menu.findUniqueOrThrow({
      where: { id: menuId },
    });
    if (menu.storeId !== storeId) {
      throw new BadRequestException('This menu does not belong to your store');
    }
  }

  private normalizeProductSettings(dto: any) {
    const productType = dto.productType || 'general';
    if (productType !== 'food') {
      return {
        productType: 'general',
        menuId: null,
        menuSection: null,
        dietaryTags: [],
        allergens: [],
        ingredients: null,
        foodOptions: null,
        availableDays: [],
        availableFrom: null,
        availableUntil: null,
        prepTimeMinutes: null,
        isMadeToOrder: false,
        soldOutToday: false,
      };
    }
    return {
      productType: 'food',
      menuId: dto.menuId || null,
      dietaryTags: dto.dietaryTags || [],
      allergens: dto.allergens || [],
      availableDays: dto.availableDays || [],
      prepTimeMinutes:
        dto.prepTimeMinutes == null ? null : Number(dto.prepTimeMinutes),
      isMadeToOrder: Boolean(dto.isMadeToOrder),
      soldOutToday: Boolean(dto.soldOutToday),
    };
  }
}
