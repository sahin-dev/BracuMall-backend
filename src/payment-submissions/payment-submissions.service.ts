import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type CreateDto = {
  orderId?: string;
  preOrderId?: string;
  donationId?: string;
  sellerPaymentMethodId?: string;
  platformPaymentMethodId?: string;
  amount: number;
  transactionId: string;
  paidAt: string;
  screenshotUrl: string;
};

@Injectable()
export class PaymentSubmissionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateDto, submittedBy: string) {
    const targets = [dto.orderId, dto.preOrderId, dto.donationId].filter(
      Boolean,
    );
    if (targets.length !== 1) {
      throw new BadRequestException(
        'Provide exactly one of orderId, preOrderId, or donationId',
      );
    }

    let methodLabel: string;
    let transactionKey: string;
    let expectedAmount: number;
    let notifyUserId: string | undefined;
    let notifyAdmins = false;

    if (dto.orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: dto.orderId },
      });
      if (order.buyerId !== submittedBy)
        throw new ForbiddenException('Not your order');
      if (['cancelled', 'delivered'].includes(order.status))
        throw new BadRequestException('This order is not accepting payments');
      if (!['unpaid', 'rejected'].includes(order.paymentStatus))
        throw new BadRequestException('A payment is already being reviewed or has been verified');
      if (!dto.sellerPaymentMethodId)
        throw new BadRequestException('sellerPaymentMethodId is required');
      const method = await this.prisma.sellerPaymentMethod.findUniqueOrThrow({
        where: { id: dto.sellerPaymentMethodId },
      });
      if (method.storeId !== order.storeId)
        throw new BadRequestException(
          'Payment method does not belong to this seller',
        );
      if (!method.isActive)
        throw new BadRequestException('This payment method is not active');
      methodLabel = method.label;
      transactionKey = `seller:${method.id}:${dto.transactionId.trim().toLowerCase()}`;
      expectedAmount = order.total;
      notifyUserId = order.sellerId;
    } else if (dto.preOrderId) {
      const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
        where: { id: dto.preOrderId },
      });
      if (preOrder.buyerId !== submittedBy)
        throw new ForbiddenException('Not your pre-order');
      if (['cancelled', 'fulfilled'].includes(preOrder.status))
        throw new BadRequestException('This pre-order is not accepting payments');
      if (!dto.sellerPaymentMethodId)
        throw new BadRequestException('sellerPaymentMethodId is required');
      const method = await this.prisma.sellerPaymentMethod.findUniqueOrThrow({
        where: { id: dto.sellerPaymentMethodId },
      });
      if (method.storeId !== preOrder.storeId)
        throw new BadRequestException(
          'Payment method does not belong to this seller',
        );
      if (!method.isActive)
        throw new BadRequestException('This payment method is not active');
      methodLabel = method.label;
      transactionKey = `seller:${method.id}:${dto.transactionId.trim().toLowerCase()}`;
      expectedAmount =
        preOrder.paymentType === 'prepaid'
          ? Number(preOrder.depositAmount || 0)
          : preOrder.totalAmount;
      notifyUserId = preOrder.sellerId;
    } else {
      const donation = await this.prisma.donation.findUniqueOrThrow({
        where: { id: dto.donationId },
      });
      if (donation.donorId !== submittedBy)
        throw new ForbiddenException('Not your donation');
      if (!dto.platformPaymentMethodId)
        throw new BadRequestException('platformPaymentMethodId is required');
      const method = await this.prisma.platformPaymentMethod.findUniqueOrThrow({
        where: { id: dto.platformPaymentMethodId },
      });
      if (!method.isActive)
        throw new BadRequestException('This payment method is not active');
      methodLabel = method.label;
      transactionKey = `platform:${method.id}:${dto.transactionId.trim().toLowerCase()}`;
      expectedAmount = donation.amount;
      notifyAdmins = true;
    }

    if (Math.abs(dto.amount - expectedAmount) > 0.009) {
      throw new BadRequestException(`Payment amount must be Tk ${expectedAmount}`);
    }
    const paidAt = new Date(dto.paidAt);
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000)
      throw new BadRequestException('Payment time cannot be in the future');
    const duplicate = await this.prisma.paymentSubmission.findFirst({
      where: { transactionKey },
    });
    if (duplicate)
      throw new BadRequestException('This transaction ID has already been submitted');
    const existingPending = await this.prisma.paymentSubmission.findFirst({
      where: {
        status: 'pending',
        ...(dto.orderId
          ? { orderId: dto.orderId }
          : dto.preOrderId
            ? { preOrderId: dto.preOrderId }
            : { donationId: dto.donationId }),
      },
    });
    if (existingPending)
      throw new BadRequestException('A payment proof is already awaiting review');

    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentSubmission.create({
        data: {
          orderId: dto.orderId,
          preOrderId: dto.preOrderId,
          donationId: dto.donationId,
          sellerPaymentMethodId: dto.sellerPaymentMethodId,
          platformPaymentMethodId: dto.platformPaymentMethodId,
          methodLabel,
          submittedBy,
          amount: dto.amount,
          transactionId: dto.transactionId.trim(),
          transactionKey,
          paidAt,
          screenshotUrl: dto.screenshotUrl,
        },
      });
      if (dto.orderId) {
        await tx.order.update({
          where: { id: dto.orderId },
          data: { paymentStatus: 'pending_verification' },
        });
      }
      if (dto.preOrderId) {
        await tx.preOrder.update({
          where: { id: dto.preOrderId },
          data: { status: 'awaiting_payment' },
        });
      }
      return created;
    });

    const notifyBody = `TK ${dto.amount} via ${methodLabel}`;
    if (notifyAdmins) {
      await this.notifications.notifyAdmins({
        type: 'payment_submitted',
        title: 'Payment proof submitted for a donation',
        body: notifyBody,
        link: '/admin/donations',
      });
    } else if (notifyUserId) {
      await this.notifications.create(notifyUserId, {
        type: 'payment_submitted',
        title: 'Payment proof submitted — please verify',
        body: notifyBody,
        link: dto.orderId ? '/seller/orders' : '/seller/pre-orders',
      });
    }

    return submission;
  }

  async findFor(
    query: { orderId?: string; preOrderId?: string; donationId?: string },
    userId: string,
    role: string,
  ) {
    const targets = [query.orderId, query.preOrderId, query.donationId].filter(
      Boolean,
    );
    if (targets.length !== 1) {
      throw new BadRequestException(
        'Provide exactly one of orderId, preOrderId, or donationId',
      );
    }

    if (query.orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: query.orderId },
      });
      if (
        role !== 'admin' &&
        order.buyerId !== userId &&
        order.sellerId !== userId
      )
        throw new ForbiddenException();
      return this.prisma.paymentSubmission.findMany({
        where: { orderId: query.orderId },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (query.preOrderId) {
      const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
        where: { id: query.preOrderId },
      });
      if (
        role !== 'admin' &&
        preOrder.buyerId !== userId &&
        preOrder.sellerId !== userId
      )
        throw new ForbiddenException();
      return this.prisma.paymentSubmission.findMany({
        where: { preOrderId: query.preOrderId },
        orderBy: { createdAt: 'desc' },
      });
    }
    const donation = await this.prisma.donation.findUniqueOrThrow({
      where: { id: query.donationId },
    });
    if (role !== 'admin' && donation.donorId !== userId)
      throw new ForbiddenException();
    return this.prisma.paymentSubmission.findMany({
      where: { donationId: query.donationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verify(
    id: string,
    dto: { status: 'verified' | 'rejected'; rejectionReason?: string },
    verifierId: string,
    role: string,
  ) {
    const submission = await this.prisma.paymentSubmission.findUniqueOrThrow({
      where: { id },
    });
    if (submission.status !== 'pending')
      throw new BadRequestException('Submission already reviewed');

    if (submission.orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: submission.orderId },
      });
      if (role !== 'admin' && order.sellerId !== verifierId)
        throw new ForbiddenException();
      if (dto.status === 'verified') {
        const nextStatus =
          order.status === 'pending' ? 'confirmed' : order.status;
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'paid' as any, status: nextStatus as any },
        });
        await this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: nextStatus as any,
            note: 'Payment verified',
            changedBy: verifierId,
          },
        });
      } else {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'rejected' as any },
        });
      }
    } else if (submission.preOrderId) {
      const preOrder = await this.prisma.preOrder.findUniqueOrThrow({
        where: { id: submission.preOrderId },
      });
      if (role !== 'admin' && preOrder.sellerId !== verifierId)
        throw new ForbiddenException();
      if (dto.status === 'verified') {
        await this.prisma.preOrder.update({
          where: { id: preOrder.id },
          data: { status: 'confirmed' as any },
        });
      } else {
        await this.prisma.preOrder.update({
          where: { id: preOrder.id },
          data: { status: 'pending' },
        });
      }
    } else if (submission.donationId) {
      if (role !== 'admin')
        throw new ForbiddenException('Only admin can verify donations');
      await this.prisma.donation.update({
        where: { id: submission.donationId },
        data: { status: dto.status as any },
      });
    }

    const updated = await this.prisma.paymentSubmission.update({
      where: { id },
      data: {
        status: dto.status as any,
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });

    await this.notifications.create(submission.submittedBy, {
      type: dto.status === 'verified' ? 'payment_verified' : 'payment_rejected',
      title: dto.status === 'verified' ? 'Payment verified' : 'Payment rejected',
      body: dto.rejectionReason,
      link: submission.orderId ? '/buyer/orders' : submission.preOrderId ? '/buyer/pre-orders' : '/buyer/donate',
    });

    return updated;
  }
}
