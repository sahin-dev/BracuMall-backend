import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

export const PRE_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  awaiting_payment: [],
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
    private platformSettings: PlatformSettingsService,
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
    let depositAmount: number | null = null;
    if (paymentType === 'prepaid') {
      depositAmount = Number(product.preOrderDepositAmount || 0) * dto.quantity;
      if (!depositAmount) {
        throw new BadRequestException(
          'This prepaid pre-order product does not have a deposit amount set',
        );
      }
    } else {
      const percent = await this.resolvePostpaidDepositPercent(product);
      depositAmount = Number(
        ((product.price * dto.quantity * percent) / 100).toFixed(2),
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
      if (
        (reserved._sum.quantity || 0) + dto.quantity >
        product.preOrderLimit
      ) {
        throw new BadRequestException(
          'This pre-order has reached its reservation limit',
        );
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

  private async resolvePostpaidDepositPercent(product: {
    storeId: string;
    preOrderPostpaidDepositPercent?: number | null;
  }) {
    if (product.preOrderPostpaidDepositPercent != null) {
      return product.preOrderPostpaidDepositPercent;
    }
    const store = await this.prisma.store.findUnique({
      where: { id: product.storeId },
    });
    if (store?.postpaidDepositPercent != null) {
      return store.postpaidDepositPercent;
    }
    const settings = await this.platformSettings.getSettings();
    return settings.defaultPostpaidDepositPercent;
  }

  async findById(id: string, userId: string, role: string) {
    const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
      where: { id },
      include: { buyer: { select: preOrderBuyerSelect } },
    });
    assertOwnership(
      role === 'admin' ||
        preOrder.buyerId === userId ||
        preOrder.sellerId === userId,
      'Not your pre-order',
    );
    return preOrder;
  }

  findByBuyer(buyerId: string) {
    return this.prisma.preOrder.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  async findByProduct(productId: string, userId: string, isAdmin = false) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    assertOwnership(isAdmin || product.sellerId === userId, 'Not your product');
    return this.prisma.preOrder.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findBySeller(sellerId: string) {
    return this.prisma.preOrder.findMany({
      where: { sellerId },
      include: { buyer: { select: preOrderBuyerSelect } },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
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
    assertOwnership(
      isAdmin || preOrder.sellerId === userId,
      'Not your pre-order',
    );
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
    const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
      where: { id },
    });
    assertOwnership(preOrder.buyerId === buyerId, 'Not your pre-order');
    if (preOrder.status !== 'pending')
      throw new BadRequestException(
        preOrder.status === 'awaiting_payment'
          ? 'Your deposit proof must be reviewed before this pre-order can be cancelled. Contact the seller for help.'
          : 'This pre-order can no longer be cancelled',
      );
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
      take: MAX_LIST_SIZE,
    });
  }
}
