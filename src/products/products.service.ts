import {
  BadRequestException,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private storesService: StoresService,
  ) {}

  async create(dto: any, sellerId: string) {
    const store = await this.storesService.findByOwner(sellerId);
    this.assertFoodStoreCompatibility(store.mode, dto.productType);
    this.assertCategoryAllowed(store, dto.categoryId);
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id: dto.categoryId },
    });
    if (dto.productType === 'food' && dto.menuId) {
      await this.assertMenuOwnership(store.id, dto.menuId);
    }
    const preOrderSettings = this.normalizePreOrderSettings(dto);
    const productSettings = this.normalizeProductSettings(dto);
    return this.prisma.product.create({
      data: {
        ...dto,
        ...preOrderSettings,
        ...productSettings,
        sellerId,
        storeId: store.id,
        categoryName: category.name,
      },
    });
  }

  async findAll(query: any = {}) {
    const where: any = { isActive: true };
    if (query.search) {
      where.OR = ['name', 'description', 'categoryName', 'menuSection', 'ingredients'].map((field) => ({
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
    const allowedSortFields = new Set(['createdAt', 'price', 'ratingAvg', 'totalSold', 'name']);
    const [requestedSortField, requestedSortDirection] = String(query.sort || 'createdAt:desc').split(':');
    const sortField = allowedSortFields.has(requestedSortField) ? requestedSortField : 'createdAt';
    const orderBy: any = { [sortField]: requestedSortDirection === 'asc' ? 'asc' : 'desc' };
    const take = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = Math.max(Number(query.skip) || 0, 0);
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
      where,
      orderBy,
      take,
      skip,
    }),
      query.withMeta === 'true' ? this.prisma.product.count({ where }) : Promise.resolve(0),
    ]);
    return query.withMeta === 'true' ? { items, total, limit: take, skip } : items;
  }

  findById(id: string) {
    return this.prisma.product.findUniqueOrThrow({ where: { id } });
  }

  async update(id: string, dto: any, sellerId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    if (product.sellerId !== sellerId)
      throw new ForbiddenException('Not your product');
    if (dto.categoryId) {
      const category = await this.prisma.category.findUniqueOrThrow({
        where: { id: dto.categoryId },
      });
      dto.categoryName = category.name;
    }
    const store = await this.storesService.findByOwner(sellerId);
    this.assertFoodStoreCompatibility(store.mode, dto.productType ?? product.productType);
    this.assertCategoryAllowed(store, dto.categoryId ?? product.categoryId);
    const nextProductType = dto.productType ?? product.productType;
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
      },
    });
  }

  async remove(id: string, sellerId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
    });
    if (product.sellerId !== sellerId)
      throw new ForbiddenException('Not your product');
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  findBySeller(sellerId: string) {
    return this.prisma.product.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllAdmin() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
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

  private assertFoodStoreCompatibility(storeMode: string, productType?: string) {
    if (productType === 'food' && storeMode === 'general') {
      throw new BadRequestException('Enable food or hybrid mode in store settings before adding food products');
    }
  }

  private assertCategoryAllowed(store: { sellingCategories: string[] }, categoryId?: string) {
    if (!store.sellingCategories?.length) return;
    if (!categoryId || !store.sellingCategories.includes(categoryId)) {
      throw new BadRequestException(
        "This category isn't enabled for your store. Ask an admin to update your selling categories.",
      );
    }
  }

  private async assertMenuOwnership(storeId: string, menuId: string) {
    const menu = await this.prisma.menu.findUniqueOrThrow({ where: { id: menuId } });
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
      prepTimeMinutes: dto.prepTimeMinutes == null ? null : Number(dto.prepTimeMinutes),
      isMadeToOrder: Boolean(dto.isMadeToOrder),
      soldOutToday: Boolean(dto.soldOutToday),
    };
  }
}
