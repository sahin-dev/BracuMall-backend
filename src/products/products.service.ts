import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CategoryFilterType,
  ClothingAudience,
  ClothingType,
  FoodMealType,
  ProductCondition,
  ProductType,
  SpiceLevel,
  StoreMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';
import { resolveCategoryFilterType } from '../common/utils/category-filter.util';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private storesService: StoresService,
  ) {}

  async create(dto: any, sellerId: string) {
    const store = await this.storesService.findByOwner(sellerId);
    return this.createForStore(store, dto);
  }

  async createForAdminStore(storeId: string, dto: any) {
    const store = await this.storesService.getAdminManagedStoreOrThrow(storeId);
    return this.createForStore(store, dto);
  }

  private async createForStore(store: any, dto: any) {
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id: store.categoryId },
    });
    const categoryFilterType = resolveCategoryFilterType(category);
    const productType = this.defaultProductType(store.mode, dto.productType);
    this.assertProductTypeAllowed(store.mode, productType);
    if (productType === ProductType.food && dto.menuId) {
      await this.assertMenuOwnership(store.id, dto.menuId);
    }
    const nextProduct = { ...dto, productType };
    this.assertPreOrderAllowed(store, nextProduct);
    const preOrderSettings = this.normalizePreOrderSettings(nextProduct);
    const productSettings = this.normalizeProductSettings(
      nextProduct,
      categoryFilterType,
    );
    return this.prisma.product.create({
      data: {
        ...nextProduct,
        ...preOrderSettings,
        ...productSettings,
        sellerId: store.ownerId,
        storeId: store.id,
        // A product always sells under its store's one category — never
        // client-selectable, so it can't drift from what the store was
        // approved to sell.
        categoryId: store.categoryId,
        categoryName: store.categoryName,
        isAdminManaged: store.isAdminManaged,
      },
    });
  }

  private assertPreOrderAllowed(store: { isAdminManaged: boolean }, dto: any) {
    if (dto.isPreOrder && !store.isAdminManaged) {
      throw new BadRequestException(
        'Pre-order is only available for admin-managed stores',
      );
    }
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
        'cuisine',
        'brand',
        'material',
      ].map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.storeId) where.storeId = query.storeId;
    const minPrice = this.parseOptionalNumber(query.minPrice, 'Minimum price', 0);
    const maxPrice = this.parseOptionalNumber(query.maxPrice, 'Maximum price', 0);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      throw new BadRequestException(
        'Minimum price cannot be greater than maximum price',
      );
    }
    if (minPrice !== null) where.price = { ...where.price, gte: minPrice };
    if (maxPrice !== null) where.price = { ...where.price, lte: maxPrice };
    if (query.isPreOrder !== undefined) {
      this.assertBooleanQuery(query.isPreOrder, 'pre-order');
      where.isPreOrder = query.isPreOrder === 'true';
    }
    if (query.productType) {
      this.assertEnumValue(ProductType, query.productType, 'product type');
      where.productType = query.productType;
    }
    if (query.condition) {
      this.assertEnumValue(ProductCondition, query.condition, 'condition');
      where.condition = query.condition;
    }
    if (query.isNegotiable !== undefined) {
      this.assertBooleanQuery(query.isNegotiable, 'negotiable');
      where.isNegotiable = query.isNegotiable === 'true';
    }
    if (query.dietaryTag) where.dietaryTags = { has: query.dietaryTag };
    if (query.mealType) {
      this.assertEnumValue(FoodMealType, query.mealType, 'meal type');
      where.mealType = query.mealType;
    }
    if (query.cuisine)
      where.cuisine = { contains: query.cuisine, mode: 'insensitive' };
    if (query.spiceLevel) {
      this.assertEnumValue(SpiceLevel, query.spiceLevel, 'spice level');
      where.spiceLevel = query.spiceLevel;
    }
    if (query.clothingType) {
      this.assertEnumValue(ClothingType, query.clothingType, 'clothing type');
      where.clothingType = query.clothingType;
    }
    if (query.clothingAudience) {
      this.assertEnumValue(
        ClothingAudience,
        query.clothingAudience,
        'clothing audience',
      );
      where.clothingAudience = query.clothingAudience;
    }
    if (query.size) where.sizes = { has: String(query.size).toUpperCase() };
    if (query.color) where.colors = { has: String(query.color).toLowerCase() };
    if (query.brand)
      where.brand = { contains: query.brand, mode: 'insensitive' };
    if (query.material)
      where.material = { contains: query.material, mode: 'insensitive' };
    if (query.availableDay) where.availableDays = { has: query.availableDay };
    if (query.excludeSoldOut !== undefined) {
      this.assertBooleanQuery(query.excludeSoldOut, 'exclude sold out');
      if (query.excludeSoldOut === 'true') where.soldOutToday = false;
    }
    if (query.inStock !== undefined)
      this.assertBooleanQuery(query.inStock, 'in stock');
    if (query.inStock === 'true') {
      where.stock = { ...where.stock, gt: 0 };
      where.soldOutToday = false;
    }
    if (query.hasDiscount !== undefined)
      this.assertBooleanQuery(query.hasDiscount, 'discount');
    if (query.hasDiscount === 'true') where.discount = { gt: 0 };
    if (query.minRating) {
      const minRating = Number(query.minRating);
      if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) {
        throw new BadRequestException('Minimum rating must be between 0 and 5');
      }
      where.ratingAvg = { gte: minRating };
    }
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
    const orderBy: any = [
      { isAdminManaged: 'desc' },
      { [sortField]: requestedSortDirection === 'asc' ? 'asc' : 'desc' },
    ];
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
    return this.updateForStore(product, store, dto);
  }

  async updateForAdmin(id: string, dto: any) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    const store = await this.storesService.getAdminManagedStoreOrThrow(
      product.storeId,
    );
    return this.updateForStore(product, store, dto);
  }

  private async updateForStore(product: any, store: any, dto: any) {
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id: store.categoryId },
    });
    const categoryFilterType = resolveCategoryFilterType(category);
    const nextProductType = dto.productType ?? product.productType;
    this.assertProductTypeAllowed(store.mode, nextProductType);
    if (nextProductType === 'food' && dto.menuId) {
      await this.assertMenuOwnership(store.id, dto.menuId);
    }
    const nextProduct = { ...product, ...dto };
    this.assertPreOrderAllowed(store, nextProduct);
    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...dto,
        ...this.normalizePreOrderSettings(nextProduct),
        ...this.normalizeProductSettings(nextProduct, categoryFilterType),
        // A product's category always mirrors its store's single category —
        // never editable per product, even if a stale value is sent.
        categoryId: store.categoryId,
        categoryName: store.categoryName,
        isAdminManaged: store.isAdminManaged,
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

  async removeForAdmin(id: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    await this.storesService.getAdminManagedStoreOrThrow(product.storeId);
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

  async findByStoreForAdmin(storeId: string) {
    await this.storesService.getAdminManagedStoreOrThrow(storeId);
    return this.prisma.product.findMany({
      where: { storeId },
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
        preOrderPostpaidDepositPercent: null,
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
    let postpaidDepositPercent: number | null = null;
    if (
      paymentType === 'postpaid' &&
      dto.preOrderPostpaidDepositPercent !== undefined &&
      dto.preOrderPostpaidDepositPercent !== null &&
      dto.preOrderPostpaidDepositPercent !== ''
    ) {
      postpaidDepositPercent = Number(dto.preOrderPostpaidDepositPercent);
      if (
        !Number.isFinite(postpaidDepositPercent) ||
        postpaidDepositPercent <= 0 ||
        postpaidDepositPercent > 100
      ) {
        throw new BadRequestException(
          'preOrderPostpaidDepositPercent must be between 0 and 100',
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
      preOrderPostpaidDepositPercent: postpaidDepositPercent,
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

  private normalizeProductSettings(
    dto: any,
    categoryFilterType: CategoryFilterType,
  ) {
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
        mealType: null,
        cuisine: null,
        spiceLevel: null,
        clothingType:
          categoryFilterType === CategoryFilterType.clothing
            ? dto.clothingType || null
            : null,
        clothingAudience:
          categoryFilterType === CategoryFilterType.clothing
            ? dto.clothingAudience || null
            : null,
        sizes:
          categoryFilterType === CategoryFilterType.clothing
            ? (dto.sizes || []).map((size: string) => size.trim().toUpperCase())
            : [],
        colors:
          categoryFilterType === CategoryFilterType.clothing
            ? (dto.colors || []).map((color: string) =>
                color.trim().toLowerCase(),
              )
            : [],
        brand:
          categoryFilterType === CategoryFilterType.clothing
            ? dto.brand?.trim() || null
            : null,
        material:
          categoryFilterType === CategoryFilterType.clothing
            ? dto.material?.trim() || null
            : null,
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
      mealType: dto.mealType || null,
      cuisine: dto.cuisine?.trim() || null,
      spiceLevel: dto.spiceLevel || null,
      clothingType: null,
      clothingAudience: null,
      sizes: [],
      colors: [],
      brand: null,
      material: null,
    };
  }

  private assertEnumValue(
    enumObject: Record<string, string>,
    value: string,
    label: string,
  ) {
    if (!Object.values(enumObject).includes(value)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  private assertBooleanQuery(value: unknown, label: string) {
    if (value !== 'true' && value !== 'false') {
      throw new BadRequestException(`Invalid ${label} filter`);
    }
  }

  private parseOptionalNumber(value: unknown, label: string, minimum?: number) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
      throw new BadRequestException(`${label} must be a valid number`);
    if (minimum !== undefined && parsed < minimum)
      throw new BadRequestException(`${label} must be at least ${minimum}`);
    return parsed;
  }
}
