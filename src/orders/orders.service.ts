import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  campusDayAndTime,
  isItemAvailableNow,
} from '../common/utils/availability.util';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const orderBuyerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
} as const;

type CreateOrderInput = {
  items: Array<{ productId: string; quantity: number }>;
  deliveryLocation: string;
  fulfillmentType?: 'pickup' | 'delivery';
  requestedFor?: string;
  notes?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateOrderInput, buyerId: string) {
    if (dto.items.length === 0)
      throw new BadRequestException('Order must contain at least one item');
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length)
      throw new BadRequestException('One or more products were not found');
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const authoritativeItems = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      if (!product.isActive || product.isPreOrder || product.soldOutToday)
        throw new BadRequestException(`${product.name} is not available`);
      if (product.sellerId === buyerId)
        throw new BadRequestException('You cannot buy your own product');
      if (product.stock < item.quantity)
        throw new BadRequestException(`Not enough stock for ${product.name}`);
      return { product, quantity: item.quantity };
    });
    const sellerIds = new Set(
      authoritativeItems.map((item) => item.product.sellerId),
    );
    if (sellerIds.size !== 1)
      throw new BadRequestException(
        'A direct order may only contain items from one seller',
      );

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: authoritativeItems[0].product.storeId },
    });
    if (!store.isActive)
      throw new BadRequestException('This store is currently unavailable');
    const fulfillmentType = dto.fulfillmentType || 'pickup';
    if (fulfillmentType === 'pickup' && !store.acceptsPickup)
      throw new BadRequestException('This store does not offer pickup');
    if (fulfillmentType === 'delivery' && !store.acceptsDelivery)
      throw new BadRequestException('This store does not offer delivery');
    const requestedFor = dto.requestedFor ? new Date(dto.requestedFor) : null;
    if (requestedFor && requestedFor.getTime() < Date.now())
      throw new BadRequestException(
        'Scheduled fulfillment time must be in the future',
      );
    if (store.mode !== 'general' && !store.isOpen && !requestedFor)
      throw new BadRequestException(
        'This store is currently closed; choose a scheduled time',
      );
    const fulfillmentAt = requestedFor ?? new Date();
    const { day: fulfillmentDay, time: fulfillmentTime } =
      campusDayAndTime(fulfillmentAt);
    if (store.mode !== 'general') {
      const hours = store.openingHours as Record<
        string,
        { enabled?: boolean; open?: string; close?: string }
      > | null;
      const dayHours = hours?.[fulfillmentDay];
      if (
        dayHours &&
        (!dayHours.enabled ||
          (dayHours.open && fulfillmentTime < dayHours.open) ||
          (dayHours.close && fulfillmentTime > dayHours.close))
      )
        throw new BadRequestException(
          'This store is not serving at the selected time',
        );
    }
    const menuIds = [
      ...new Set(
        authoritativeItems.map(({ product }) => product.menuId).filter(Boolean),
      ),
    ] as string[];
    const menus = menuIds.length
      ? await this.prisma.menu.findMany({ where: { id: { in: menuIds } } })
      : [];
    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
    for (const { product } of authoritativeItems) {
      if (product.productType !== 'food') continue;
      const menu = product.menuId
        ? (menuMap.get(product.menuId) ?? null)
        : null;
      const availability = isItemAvailableNow(menu, product, fulfillmentAt);
      if (!availability.available)
        throw new BadRequestException(availability.reason);
    }
    const subtotal = authoritativeItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
    if (store.minimumOrder && subtotal < store.minimumOrder)
      throw new BadRequestException(
        `Minimum order is Tk ${store.minimumOrder}`,
      );
    const total =
      subtotal + (fulfillmentType === 'delivery' ? store.deliveryFee : 0);

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of authoritativeItems) {
        const reserved = await tx.product.updateMany({
          where: {
            id: item.product.id,
            isActive: true,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (reserved.count !== 1)
          throw new BadRequestException(
            `${item.product.name} no longer has enough stock`,
          );
      }
      return tx.order.create({
        data: {
          buyerId,
          sellerId: authoritativeItems[0].product.sellerId,
          storeId: store.id,
          total,
          deliveryLocation: dto.deliveryLocation,
          fulfillmentType,
          requestedFor,
          pickupCode:
            fulfillmentType === 'pickup'
              ? randomInt(100000, 1000000).toString()
              : null,
          notes: dto.notes,
          items: {
            create: authoritativeItems.map(({ product, quantity }) => ({
              productId: product.id,
              productName: product.name,
              price: product.price,
              quantity,
              productImage: product.images[0],
              productType: product.productType,
            })),
          },
          statusHistory: { create: { status: 'pending', changedBy: buyerId } },
        },
        include: { items: true },
      });
    });

    await this.notifications.create(order.sellerId, {
      type: 'order_status',
      title: 'New order received',
      body: `Tk ${order.total} - ${order.items.length} item(s)`,
      link: '/seller/orders',
    });
    return order;
  }

  private assertOrderAccess(
    order: { buyerId: string; sellerId: string },
    userId: string,
    role: string,
  ) {
    assertOwnership(
      role === 'admin' || order.buyerId === userId || order.sellerId === userId,
      'Not your order',
    );
  }

  async findById(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: true, buyer: { select: orderBuyerSelect } },
    });
    this.assertOrderAccess(order, userId, role);
    return order;
  }

  async findByBuyer(buyerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { buyerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
    const reviews = await this.prisma.review.findMany({
      where: { buyerId, orderId: { in: orders.map((order) => order.id) } },
      select: { id: true, orderId: true, productId: true, rating: true },
    });
    return orders.map((order) => ({
      ...order,
      reviews: reviews.filter((review) => review.orderId === order.id),
    }));
  }

  findBySeller(sellerId: string) {
    return this.prisma.order.findMany({
      where: { sellerId },
      include: { items: true, buyer: { select: orderBuyerSelect } },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findAll() {
    return this.prisma.order.findMany({
      include: { items: true, buyer: { select: orderBuyerSelect } },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  async updateStatus(
    id: string,
    dto: { status: string; notes?: string },
    userId: string,
    isAdmin = false,
  ) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });
    assertOwnership(isAdmin || order.sellerId === userId, 'Not your order');
    if (!ORDER_TRANSITIONS[order.status]?.includes(dto.status))
      throw new BadRequestException(
        `Order cannot move from ${order.status} to ${dto.status}`,
      );
    if (
      dto.status === 'cancelled' &&
      order.paymentStatus === 'pending_verification'
    )
      throw new BadRequestException(
        'Review the submitted payment proof before cancelling this order.',
      );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'cancelled' && !order.inventoryRestored) {
        for (const item of order.items) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      if (dto.status === 'delivered') {
        for (const item of order.items) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { totalSold: { increment: item.quantity } },
          });
        }
      }
      const nextOrder = await tx.order.update({
        where: { id },
        data: {
          status: dto.status as any,
          notes: dto.notes ?? order.notes,
          inventoryRestored:
            dto.status === 'cancelled' ? true : order.inventoryRestored,
          cancelledBy: dto.status === 'cancelled' ? userId : undefined,
          cancellationReason:
            dto.status === 'cancelled' ? dto.notes : undefined,
          cancelledAt: dto.status === 'cancelled' ? new Date() : undefined,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: dto.status as any,
          note: dto.notes,
          changedBy: userId,
        },
      });
      return nextOrder;
    });
    await this.notifications.create(order.buyerId, {
      type: 'order_status',
      title: `Order status updated: ${dto.status}`,
      body: dto.notes,
      link: '/buyer/orders',
    });
    return updated;
  }

  async cancelByBuyer(id: string, buyerId: string, reason?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
    assertOwnership(order.buyerId === buyerId, 'Not your order');
    if (order.status !== 'pending')
      throw new BadRequestException(
        'Only pending orders can be cancelled by the buyer',
      );
    if (order.paymentStatus === 'pending_verification')
      throw new BadRequestException(
        'Your payment proof must be reviewed before this order can be cancelled. Contact the seller for help.',
      );
    if (order.paymentStatus === 'paid')
      throw new BadRequestException(
        'Paid orders require seller-assisted cancellation and refund handling.',
      );
    const updated = await this.updateStatus(
      id,
      { status: 'cancelled', notes: reason || 'Cancelled by buyer' },
      buyerId,
      true,
    );
    await this.notifications.create(order.sellerId, {
      type: 'order_status',
      title: 'Buyer cancelled an order',
      body: reason,
      link: '/seller/orders',
    });
    return updated;
  }

  async findHistory(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    this.assertOrderAccess(order, userId, role);
    return this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { changedAt: 'asc' },
    });
  }
}
