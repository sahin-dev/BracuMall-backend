import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StoreMode, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StoresService } from '../stores/stores.service';
import { AccessControlService } from '../access-control/access-control.service';
import { ALL_PERMISSIONS } from '../access-control/permission.constants';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventsGateway } from '../events/events.gateway';
import { AdminCreateUserDto } from './dto/admin-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private stores: StoresService,
    private accessControl: AccessControlService,
    private analytics: AnalyticsService,
    private events: EventsGateway,
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
      totalVisitors,
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
      this.analytics.getTotalVisitors(),
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
      totalVisitors,
      onlineNow: this.events.getOnlineCount(),
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { accessRole: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [orders, applications, complaintsFiled, complaintsAgainst, store] = await Promise.all([
      this.prisma.order.findMany({ where: { buyerId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.sellerApplication.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.complaint.findMany({ where: { filedById: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.complaint.findMany({ where: { againstUserId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.store.findFirst({ where: { ownerId: id } }),
    ]);

    const products = store
      ? await this.prisma.product.findMany({ where: { storeId: store.id }, orderBy: { createdAt: 'desc' } })
      : [];

    const safeUser = this.withoutSecrets(user);
    return { user: safeUser, orders, applications, complaintsFiled, complaintsAgainst, store, products };
  }

  async getUserCreationOptions() {
    const [accessRoles, categories] = await Promise.all([
      this.prisma.accessRole.findMany({ orderBy: [{ accountType: 'asc' }, { name: 'asc' }] }),
      this.prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    return { accessRoles, categories };
  }

  async getRoleOptions(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.accessRole.findMany({
      where: { accountType: user.role },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
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

  async createUser(dto: AdminCreateUserDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    const accountType = dto.accountType;
    const accessRole = await this.accessControl.resolveRole(dto.accessRoleId, accountType);

    let category: { id: string; name: string; mode: StoreMode; isActive: boolean } | null = null;
    if (accountType === UserRole.seller) {
      if (!dto.storeName?.trim() || !dto.categoryId) {
        throw new BadRequestException('Store name and category are required for a seller');
      }
      category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category?.isActive) throw new BadRequestException('Select an active seller category');
    }

    const password = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          password,
          role: accountType,
          accessRoleId: accessRole.id,
          isApproved: accountType !== UserRole.buyer,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          phone: dto.phone?.trim(),
          studentId: dto.studentId?.trim(),
          department: dto.department?.trim(),
        },
      });
      if (accountType === UserRole.seller && category) {
        await this.stores.createForOwner(created.id, dto.storeName!.trim(), {
          categoryId: category.id,
          categoryName: category.name,
          mode: category.mode,
          isAdminManaged: Boolean(dto.isPriorityStore),
          createdByAdminId: dto.isPriorityStore ? actorId : undefined,
        }, tx);
      }
      return created;
    });
    return this.withoutSecrets({ ...user, accessRole });
  }

  async assignAccessRole(id: string, accessRoleId: string, actorId: string) {
    const [user, accessRole] = await Promise.all([
      this.prisma.user.findUnique({ where: { id } }),
      this.prisma.accessRole.findUnique({ where: { id: accessRoleId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!accessRole) throw new NotFoundException('Access role not found');
    if (accessRole.accountType !== user.role) {
      throw new BadRequestException(`Assign a ${user.role} access role to this account`);
    }
    if (user.accessRoleId === accessRoleId) {
      const unchanged = await this.prisma.user.findUniqueOrThrow({
        where: { id },
        include: { accessRole: true },
      });
      return this.withoutSecrets(unchanged);
    }
    if (id === actorId && user.role === UserRole.admin && !accessRole.permissions.includes(ALL_PERMISSIONS)) {
      throw new BadRequestException('You cannot remove your own full administrator access');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { accessRoleId, sessionVersion: { increment: 1 } },
      include: { accessRole: true },
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
      passwordResetOtpHash: _passwordResetOtpHash,
      passwordResetOtpExpiresAt: _passwordResetOtpExpiresAt,
      passwordResetOtpSentAt: _passwordResetOtpSentAt,
      passwordResetOtpAttempts: _passwordResetOtpAttempts,
      ...safeUser
    } = user;
    return safeUser;
  }
}
