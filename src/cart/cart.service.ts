import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { campusDayAndTime, isItemAvailableNow } from '../common/utils/availability.util';
import type { CartItem, Product, Store } from '@prisma/client';

type CheckoutInput = {
  deliveryLocation: string;
  notes?: string;
  fulfillmentType?: 'pickup' | 'delivery';
  requestedFor?: string;
};

type ValidatedCartItem = { cartItem: CartItem; product: Product };
type PreparedOrderGroup = {
  sellerId: string;
  sellerItems: ValidatedCartItem[];
  store: Store;
  total: number;
};

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) cart = await this.prisma.cart.create({ data: { userId } });
    return cart;
  }

  async getMine(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { addedAt: 'desc' },
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
    });
    const stores = await this.prisma.store.findMany({
      where: { id: { in: [...new Set(products.map((product) => product.storeId))] } },
      select: {
        id: true,
        name: true,
        mode: true,
        location: true,
        isOpen: true,
        acceptsPickup: true,
        acceptsDelivery: true,
        minimumOrder: true,
        deliveryFee: true,
        prepTimeMin: true,
        prepTimeMax: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const hydratedItems = items.map((item) => {
      const product = productMap.get(item.productId);
      return {
        ...item,
        productName: product?.name ?? item.productName,
        productImage: product?.images[0] ?? item.productImage,
        price: product?.price ?? item.price,
        availableStock: product?.stock ?? 0,
        isAvailable: Boolean(
          product?.isActive && !product.isPreOrder && !product.soldOutToday,
        ),
        productType: product?.productType ?? 'general',
      };
    });
    return { ...cart, items: hydratedItems, stores };
  }

  async addItem(userId: string, dto: { productId: string; quantity: number }) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
    });
    if (!product.isActive)
      throw new BadRequestException('Product is not available');
    if (product.isPreOrder)
      throw new BadRequestException(
        'Pre-order products must be reserved from their product page',
      );
    if (product.soldOutToday)
      throw new BadRequestException('This food item is sold out today');
    if (product.sellerId === userId)
      throw new BadRequestException('You cannot buy your own product');
    await this.assertMenuAvailability(product);

    const cart = await this.getOrCreateCart(userId);
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: product.id },
    });
    const nextQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (product.stock < nextQuantity)
      throw new BadRequestException('Not enough stock');

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity, price: product.price },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        sellerId: product.sellerId,
        storeId: product.storeId,
        productName: product.name,
        productImage: product.images[0],
        price: product.price,
        quantity: dto.quantity,
      },
    });
  }

  private async assertMenuAvailability(product: Product) {
    if (product.productType !== 'food') return;
    const menu = product.menuId
      ? await this.prisma.menu.findUnique({ where: { id: product.menuId } })
      : null;
    const availability = isItemAvailableNow(menu, product);
    if (!availability.available) throw new BadRequestException(availability.reason);
  }

  private async assertOwnedItem(itemId: string, userId: string) {
    const item = await this.prisma.cartItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: item.cartId },
    });
    if (cart.userId !== userId)
      throw new ForbiddenException('Not your cart item');
    return item;
  }

  async updateItem(itemId: string, userId: string, quantity: number) {
    const item = await this.assertOwnedItem(itemId, userId);
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: item.productId },
    });
    if (!product.isActive || product.isPreOrder || product.soldOutToday)
      throw new BadRequestException('Product is not available');
    if (product.stock < quantity)
      throw new BadRequestException('Not enough stock');
    await this.assertMenuAvailability(product);
    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity, price: product.price },
    });
  }

  async removeItem(itemId: string, userId: string) {
    await this.assertOwnedItem(itemId, userId);
    return this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { success: true };
  }

  async checkout(userId: string, dto: CheckoutInput) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
    });
    if (items.length === 0) throw new BadRequestException('Cart is empty');

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
    });
    if (products.length !== items.length)
      throw new BadRequestException(
        'One or more products are no longer available',
      );

    const productMap = new Map(products.map((product) => [product.id, product]));
    const validatedItems = items.map((cartItem) => {
      const product = productMap.get(cartItem.productId)!;
      if (!product.isActive || product.isPreOrder || product.soldOutToday)
        throw new BadRequestException(`${product.name} is no longer available`);
      if (product.sellerId === userId)
        throw new BadRequestException('You cannot buy your own product');
      if (product.stock < cartItem.quantity)
        throw new BadRequestException(
          `Only ${product.stock} of ${product.name} remain in stock`,
        );
      return { cartItem, product };
    });

    const bySeller = new Map<string, ValidatedCartItem[]>();
    for (const item of validatedItems) {
      const group = bySeller.get(item.product.sellerId) ?? [];
      group.push(item);
      bySeller.set(item.product.sellerId, group);
    }

    const fulfillmentType = dto.fulfillmentType || 'pickup';
    const requestedFor = dto.requestedFor ? new Date(dto.requestedFor) : null;
    if (requestedFor && requestedFor.getTime() < Date.now())
      throw new BadRequestException(
        'Scheduled fulfillment time must be in the future',
      );
    const fulfillmentAt = requestedFor ?? new Date();
    const { day: fulfillmentDay, time: fulfillmentTime } = campusDayAndTime(fulfillmentAt);

    const preparedGroups: PreparedOrderGroup[] = [];
    for (const [sellerId, sellerItems] of bySeller) {
      const store = await this.prisma.store.findUniqueOrThrow({
        where: { id: sellerItems[0].product.storeId },
      });
      if (!store.isActive)
        throw new BadRequestException(`${store.name} is currently unavailable`);
      if (fulfillmentType === 'pickup' && !store.acceptsPickup)
        throw new BadRequestException(`${store.name} does not offer pickup`);
      if (fulfillmentType === 'delivery' && !store.acceptsDelivery)
        throw new BadRequestException(`${store.name} does not offer delivery`);
      if (store.mode !== 'general' && !store.isOpen && !requestedFor)
        throw new BadRequestException(
          `${store.name} is currently closed; choose a scheduled time`,
        );
      if (store.mode !== 'general') {
        const hours = store.openingHours as Record<string, { enabled?: boolean; open?: string; close?: string }> | null;
        const dayHours = hours?.[fulfillmentDay];
        if (dayHours && (!dayHours.enabled || (dayHours.open && fulfillmentTime < dayHours.open) || (dayHours.close && fulfillmentTime > dayHours.close))) {
          throw new BadRequestException(`${store.name} is not serving at the selected time`);
        }
      }

      const menuIds = [...new Set(sellerItems.map(({ product }) => product.menuId).filter(Boolean))] as string[];
      const menus = menuIds.length
        ? await this.prisma.menu.findMany({ where: { id: { in: menuIds } } })
        : [];
      const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
      for (const { product } of sellerItems) {
        if (product.productType !== 'food') continue;
        const menu = product.menuId ? menuMap.get(product.menuId) ?? null : null;
        const availability = isItemAvailableNow(menu, product, fulfillmentAt);
        if (!availability.available) throw new BadRequestException(availability.reason);
      }

      const subtotal = sellerItems.reduce(
        (sum, item) =>
          sum + item.product.price * item.cartItem.quantity,
        0,
      );
      if (store.minimumOrder && subtotal < store.minimumOrder)
        throw new BadRequestException(
          `${store.name} requires a minimum order of Tk ${store.minimumOrder}`,
        );
      const total =
        subtotal +
        (fulfillmentType === 'delivery' ? store.deliveryFee : 0);
      preparedGroups.push({ sellerId, sellerItems, store, total });
    }

    const orders = await this.prisma.$transaction(async (tx) => {
      const createdOrders: any[] = [];
      for (const group of preparedGroups) {
        for (const item of group.sellerItems) {
          const reserved = await tx.product.updateMany({
            where: {
              id: item.product.id,
              isActive: true,
              stock: { gte: item.cartItem.quantity },
            },
            data: { stock: { decrement: item.cartItem.quantity } },
          });
          if (reserved.count !== 1)
            throw new BadRequestException(
              `${item.product.name} no longer has enough stock`,
            );
        }

        const order = await tx.order.create({
          data: {
            buyerId: userId,
            sellerId: group.sellerId,
            storeId: group.store.id,
            total: group.total,
            deliveryLocation: dto.deliveryLocation,
            fulfillmentType,
            requestedFor,
            pickupCode:
              fulfillmentType === 'pickup'
                ? randomInt(100000, 1000000).toString()
                : null,
            notes: dto.notes,
            items: {
              create: group.sellerItems.map(({ product, cartItem }) => ({
                productId: product.id,
                productName: product.name,
                price: product.price,
                quantity: cartItem.quantity,
                productImage: product.images[0],
                productType: product.productType,
              })),
            },
            statusHistory: {
              create: { status: 'pending', changedBy: userId },
            },
          },
          include: { items: true },
        });
        createdOrders.push(order);
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return createdOrders;
    });

    for (const order of orders) {
      await this.notifications.create(order.sellerId, {
        type: 'order_status',
        title: 'New order received',
        body: `Tk ${order.total} - ${order.items.length} item(s)`,
        link: '/seller/orders',
      });
    }
    return orders;
  }
}
