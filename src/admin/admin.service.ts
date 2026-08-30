import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getStats() {
    const [
      totalUsers,
      totalSellers,
      pendingApplications,
      totalOrders,
      ordersByStatus,
      pendingPaymentVerifications,
      pendingDonationVerifications,
      totalProducts,
      totalStores,
      foodProducts,
      foodStores,
      openComplaints,
      orderValue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'seller' } }),
      this.prisma.sellerApplication.count({ where: { status: 'pending' } }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.paymentSubmission.count({ where: { status: 'pending' } }),
      this.prisma.paymentSubmission.count({ where: { status: 'pending', donationId: { not: null } } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.store.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { isActive: true, productType: 'food' } }),
      this.prisma.store.count({ where: { isActive: true, mode: { in: ['food', 'hybrid'] } } }),
      this.prisma.complaint.count({ where: { status: { in: ['open', 'investigating'] } } }),
      this.prisma.order.aggregate({ where: { status: { not: 'cancelled' } }, _sum: { total: true } }),
    ]);

    return {
      totalUsers,
      totalSellers,
      pendingApplications,
      totalOrders,
      ordersByStatus,
      pendingPaymentVerifications,
      pendingDonationVerifications,
      totalProducts,
      totalStores,
      foodProducts,
      foodStores,
      openComplaints,
      totalOrderValue: orderValue._sum.total ?? 0,
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const [orders, applications, complaintsFiled, complaintsAgainst, store] = await Promise.all([
      this.prisma.order.findMany({ where: { buyerId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.sellerApplication.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.complaint.findMany({ where: { filedById: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.complaint.findMany({ where: { againstUserId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.store.findUnique({ where: { ownerId: id } }),
    ]);

    const products = store
      ? await this.prisma.product.findMany({ where: { storeId: store.id }, orderBy: { createdAt: 'desc' } })
      : [];

    const safeUser = this.withoutSecrets(user);
    return { user: safeUser, orders, applications, complaintsFiled, complaintsAgainst, store, products };
  }

  async setSuspended(id: string, isSuspended: boolean, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { isSuspended } });
    await this.notifications.create(id, {
      type: 'account_status',
      title: isSuspended ? 'Your account has been suspended' : 'Your account has been reactivated',
      body: reason,
    });
    return this.withoutSecrets(updated);
  }

  private withoutSecrets(user: any) {
    const {
      password: _password,
      emailOtpHash: _emailOtpHash,
      emailOtpExpiresAt: _emailOtpExpiresAt,
      emailOtpSentAt: _emailOtpSentAt,
      emailOtpAttempts: _emailOtpAttempts,
      failedLoginAttempts: _failedLoginAttempts,
      lockedUntil: _lockedUntil,
      ...safeUser
    } = user;
    return safeUser;
  }
}
