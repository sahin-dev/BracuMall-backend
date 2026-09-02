import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { assertOwnership } from '../common/utils/ownership.util';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

const applicationUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  whatsappNumber: true,
  avatar: true,
  studentId: true,
  department: true,
  role: true,
  isApproved: true,
  isEmailVerified: true,
} as const;

@Injectable()
export class SellerApplicationsService {
  constructor(
    private prisma: PrismaService,
    private storesService: StoresService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateApplicationDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') {
      throw new ForbiddenException(
        'Administrator accounts cannot become sellers',
      );
    }

    const existing = await this.prisma.sellerApplication.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'more_info_requested', 'approved'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.status === 'approved') {
      throw new BadRequestException('You are already an approved seller');
    }
    if (existing) {
      throw new BadRequestException(
        'You already have an unresolved seller application',
      );
    }

    await this.assertOwnedDocuments(userId, this.documentUrls(dto));
    const category = await this.resolveCategory(dto.categoryId);
    const application = await this.prisma.sellerApplication.create({
      data: {
        ...this.applicationData(dto),
        categoryId: category.id,
        categoryName: category.name,
        userId,
      },
      include: { user: { select: applicationUserSelect } },
    });
    await this.notifications.notifyAdmins({
      type: 'application_status',
      title: 'New seller application to review',
      body: application.user.name,
      link: '/admin/sellers',
    });
    return application;
  }

  findAll(status?: string) {
    const where: Prisma.SellerApplicationWhereInput = {};
    if (status) {
      const allowedStatuses: ApplicationStatus[] = [
        'pending',
        'more_info_requested',
        'approved',
        'rejected',
      ];
      if (!allowedStatuses.includes(status as ApplicationStatus)) {
        throw new BadRequestException('Invalid application status');
      }
      where.status = status as ApplicationStatus;
    }
    return this.prisma.sellerApplication.findMany({
      where,
      include: { user: { select: applicationUserSelect } },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  findById(id: string) {
    return this.prisma.sellerApplication.findUnique({
      where: { id },
      include: { user: { select: applicationUserSelect } },
    });
  }

  findByUser(userId: string) {
    return this.prisma.sellerApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(id: string, dto: ReviewApplicationDto, adminId: string) {
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (
      application.status === 'approved' ||
      application.status === 'rejected'
    ) {
      throw new BadRequestException(
        'This application has already been reviewed',
      );
    }
    if (dto.status === 'approved' && application.status !== 'pending') {
      throw new BadRequestException(
        'The applicant must resubmit requested information before approval',
      );
    }

    if (dto.status === 'approved') {
      const checksComplete = [
        dto.identityVerified,
        dto.studentStatusVerified,
        dto.addressVerified,
        dto.contactVerified,
        dto.documentsVerified,
      ].every(Boolean);
      const applicationComplete = [
        application.legalName,
        application.dateOfBirth,
        application.gender,
        application.phoneNumber,
        application.whatsappNumber,
        application.studentId,
        application.department,
        application.nidNumber,
        application.nidFrontUrl,
        application.nidBackUrl,
        application.studentIdUrl,
        application.presentAddress,
        application.permanentAddress,
      ].every(Boolean);
      const hasCategory = Boolean(application.categoryId);
      if (!checksComplete || !applicationComplete || !hasCategory) {
        throw new BadRequestException(
          'Complete every verification check and required applicant field before approval',
        );
      }
    }
    if (dto.status === 'rejected' && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }
    const approvedCategory =
      dto.status === 'approved'
        ? await this.resolveCategory(application.categoryId!)
        : null;

    await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.sellerApplication.updateMany({
        where: { id, status: application.status },
        data: {
          status: dto.status,
          identityVerified: Boolean(dto.identityVerified),
          studentStatusVerified: Boolean(dto.studentStatusVerified),
          addressVerified: Boolean(dto.addressVerified),
          contactVerified: Boolean(dto.contactVerified),
          documentsVerified: Boolean(dto.documentsVerified),
          verificationNote: dto.verificationNote?.trim(),
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason?.trim(),
        },
      });
      if (transitioned.count !== 1) {
        throw new ConflictException(
          'This application was changed by another administrator',
        );
      }

      if (dto.status === 'approved') {
        const sellerRole = await tx.accessRole.findUnique({ where: { slug: 'seller' } });
        const user = await tx.user.update({
          where: { id: application.userId },
          data: {
            isApproved: true,
            role: 'seller',
            accessRoleId: sellerRole?.id,
            phone: application.phoneNumber,
            whatsappNumber: application.whatsappNumber,
            studentId: application.studentId,
            department: application.department,
          },
        });
        await this.storesService.createForOwner(
          user.id,
          `${user.name}'s Store`,
          {
            categoryId: approvedCategory!.id,
            categoryName: approvedCategory!.name,
            mode: approvedCategory!.mode,
          },
          tx,
        );
      }
    });

    await this.notifications.create(application.userId, {
      type: 'application_status',
      title: `Your seller application was ${dto.status}`,
      body: dto.rejectionReason,
      link: '/seller/apply',
    });
    return this.findById(id);
  }

  async requestInfo(id: string, note: string, adminId: string) {
    if (!note.trim()) {
      throw new BadRequestException(
        'Describe the information that is required',
      );
    }
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'pending') {
      throw new BadRequestException(
        'Only pending applications can request more information',
      );
    }
    await this.prisma.sellerApplication.update({
      where: { id },
      data: {
        status: 'more_info_requested',
        adminNote: note.trim(),
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.notifications.create(application.userId, {
      type: 'application_more_info',
      title: 'Admin requested more information for your seller application',
      body: note,
      link: '/seller/apply',
    });
    return this.findById(id);
  }

  async resubmit(id: string, dto: CreateApplicationDto, userId: string) {
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');
    assertOwnership(application.userId === userId, 'Not your application');
    if (application.status !== 'more_info_requested') {
      throw new BadRequestException(
        'This application is not awaiting more information',
      );
    }

    await this.assertOwnedDocuments(userId, this.documentUrls(dto));
    const category = await this.resolveCategory(dto.categoryId);
    const updated = await this.prisma.sellerApplication.update({
      where: { id },
      data: {
        ...this.applicationData(dto),
        categoryId: category.id,
        categoryName: category.name,
        status: 'pending',
        adminNote: null,
        identityVerified: false,
        studentStatusVerified: false,
        addressVerified: false,
        contactVerified: false,
        documentsVerified: false,
        verificationNote: null,
      },
    });
    await this.notifications.notifyAdmins({
      type: 'application_status',
      title: 'Seller application resubmitted',
      body: dto.legalName,
      link: '/admin/sellers',
    });
    return updated;
  }

  private applicationData(dto: CreateApplicationDto) {
    return {
      legalName: dto.legalName.trim(),
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      phoneNumber: dto.phoneNumber.trim(),
      whatsappNumber: dto.whatsappNumber.trim(),
      studentId: dto.studentId.trim(),
      department: dto.department.trim(),
      nidNumber: dto.nidNumber.trim(),
      nidFrontUrl: dto.nidFrontUrl,
      nidBackUrl: dto.nidBackUrl,
      studentIdUrl: dto.studentIdUrl,
      presentAddress: dto.presentAddress.trim(),
      permanentAddress: dto.permanentAddress.trim(),
      documents: dto.documents || [],
      description: dto.description?.trim(),
    };
  }

  private async resolveCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category?.isActive)
      throw new BadRequestException('Select an active category');
    return category;
  }

  private documentUrls(dto: CreateApplicationDto) {
    return [
      dto.nidFrontUrl,
      dto.nidBackUrl,
      dto.studentIdUrl,
      ...(dto.documents || []),
    ];
  }

  private async assertOwnedDocuments(userId: string, urls: string[]) {
    const uniqueUrls = [...new Set(urls)];
    const ids = uniqueUrls.map((url) => {
      const match = url.match(/\/uploads\/private\/([a-f\d]{24})$/i);
      if (!match) {
        throw new BadRequestException(
          'Every verification document must be a private upload',
        );
      }
      return match[1];
    });
    const uploads = await this.prisma.privateUpload.findMany({
      where: { id: { in: ids } },
    });
    const validUploads = uploads.filter(
      (upload) =>
        upload.ownerId === userId && upload.purpose === 'seller_document',
    );
    if (validUploads.length !== ids.length) {
      throw new BadRequestException(
        'One or more verification documents do not belong to this applicant',
      );
    }
  }
}
