import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const PRE_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['awaiting_payment', 'confirmed', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

const preOrderBuyerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
} as const;

@Injectable()
export class PreOrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(
    dto: {
      productId: string;
      quantity: number;
    },
    buyerId: string,
  ) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
    });
    if (!product.isActive || !product.isPreOrder) {
      throw new BadRequestException('This product is not accepting pre-orders');
    }
    if (product.sellerId === buyerId) {
      throw new BadRequestException('You cannot pre-order your own product');
    }
    if (product.preOrderDeadline && product.preOrderDeadline <= new Date()) {
      throw new BadRequestException('Pre-order deadline has passed');
    }
    const paymentType = product.preOrderPaymentType || 'postpaid';
    const depositAmount =
      paymentType === 'prepaid'
        ? Number(product.preOrderDepositAmount || 0) * dto.quantity
        : null;
    if (paymentType === 'prepaid' && !depositAmount) {
      throw new BadRequestException(
        'This prepaid pre-order product does not have a deposit amount set',
      );
    }
    if (product.preOrderLimit) {
      const reserved = await this.prisma.preOrder.aggregate({
        where: {
          productId: product.id,
          status: { not: 'cancelled' },
        },
        _sum: { quantity: true },
      });
      if ((reserved._sum.quantity || 0) + dto.quantity > product.preOrderLimit) {
        throw new BadRequestException('This pre-order has reached its reservation limit');
      }
    }
    const preOrder = await this.prisma.preOrder.create({
      data: {
        productId: dto.productId,
        sellerId: product.sellerId,
        storeId: product.storeId,
        quantity: dto.quantity,
        price: product.price,
        totalAmount: product.price * dto.quantity,
        paymentType: paymentType as any,
        depositAmount,
        deadline: product.preOrderDeadline,
        buyerId,
      },
    });
    await this.notifications.create(product.sellerId, {
      type: 'preorder_status',
      title: 'New pre-order received',
      body: `${product.name} x ${dto.quantity}`,
      link: '/seller/pre-orders',
    });
    return preOrder;
  }

  async findById(id: string, userId: string, role: string) {
    const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
      where: { id },
      include: { buyer: { select: preOrderBuyerSelect } },
    });
    if (
      role !== 'admin' &&
      preOrder.buyerId !== userId &&
      preOrder.sellerId !== userId
    ) {
      throw new ForbiddenException('Not your pre-order');
    }
    return preOrder;
  }

  findByBuyer(buyerId: string) {
    return this.prisma.preOrder.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProduct(productId: string, userId: string, isAdmin = false) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    if (!isAdmin && product.sellerId !== userId)
      throw new ForbiddenException('Not your product');
    return this.prisma.preOrder.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findBySeller(sellerId: string) {
    return this.prisma.preOrder.findMany({
      where: { sellerId },
      include: { buyer: { select: preOrderBuyerSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    userId: string,
    isAdmin = false,
  ) {
    const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
      where: { id },
    });
    if (!isAdmin && preOrder.sellerId !== userId)
      throw new ForbiddenException('Not your pre-order');
    if (!PRE_ORDER_TRANSITIONS[preOrder.status]?.includes(status)) {
      throw new BadRequestException(
        `Pre-order cannot move from ${preOrder.status} to ${status}`,
      );
    }
    const updated = await this.prisma.preOrder.update({
      where: { id },
      data: { status: status as any },
    });
    if (status === 'fulfilled') {
      await this.prisma.product.updateMany({
        where: { id: preOrder.productId },
        data: { totalSold: { increment: preOrder.quantity } },
      });
    }
    await this.notifications.create(preOrder.buyerId, {
      type: 'preorder_status',
      title: `Pre-order status updated: ${status}`,
      link: '/buyer/pre-orders',
    });
    return updated;
  }

  async cancelByBuyer(id: string, buyerId: string) {
    const preOrder = await this.prisma.preOrder.findUniqueOrThrow({ where: { id } });
    if (preOrder.buyerId !== buyerId)
      throw new ForbiddenException('Not your pre-order');
    if (!['pending', 'awaiting_payment'].includes(preOrder.status))
      throw new BadRequestException('This pre-order can no longer be cancelled');
    const updated = await this.prisma.preOrder.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    await this.notifications.create(preOrder.sellerId, {
      type: 'preorder_status',
      title: 'Buyer cancelled a pre-order',
      link: '/seller/pre-orders',
    });
    return updated;
  }

  findAll() {
    return this.prisma.preOrder.findMany({
      include: { buyer: { select: preOrderBuyerSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
