import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { STORAGE_SERVICE } from './storage/storage.interface';
import type { StorageService } from './storage/storage.interface';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const IMAGE_FOLDERS = ['products', 'stores', 'avatars', 'payments'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE },
      fileFilter: (_req, file, cb) =>
        cb(null, file.mimetype.startsWith('image/')),
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'products',
    @CurrentUser('id') userId: string,
  ) {
    if (!file)
      throw new BadRequestException(
        'No file uploaded, or file is not an image',
      );
    if (!IMAGE_FOLDERS.includes(folder))
      throw new BadRequestException('Invalid folder');
    if (folder === 'payments') {
      const storageKey = await this.storage.savePrivate(file);
      const upload = await this.prisma.privateUpload.create({
        data: {
          ownerId: userId,
          purpose: 'payment_proof',
          storageKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      });
      return { url: `/api/uploads/private/${upload.id}` };
    }
    const url = await this.storage.save(file, `images/${folder}`);
    return { url };
  }

  @Post('document')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_SIZE },
      fileFilter: (_req, file, cb) =>
        cb(
          null,
          file.mimetype.startsWith('image/') ||
            file.mimetype === 'application/pdf',
        ),
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    if (!file)
      throw new BadRequestException(
        'No file uploaded, or file must be an image or PDF',
      );
    const storageKey = await this.storage.savePrivate(file);
    const upload = await this.prisma.privateUpload.create({
      data: {
        ownerId: userId,
        purpose: 'seller_document',
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
    return { url: `/api/uploads/private/${upload.id}` };
  }

  @Get('private/:id')
  async readPrivate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Res() response: Response,
  ) {
    const upload = await this.prisma.privateUpload.findUniqueOrThrow({
      where: { id },
    });
    let allowed = role === 'admin' || upload.ownerId === userId;
    if (!allowed && upload.purpose === 'payment_proof') {
      const url = `/api/uploads/private/${upload.id}`;
      const submission = await this.prisma.paymentSubmission.findFirst({
        where: { screenshotUrl: url },
      });
      if (submission?.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: submission.orderId },
        });
        allowed = order?.sellerId === userId;
      } else if (submission?.preOrderId) {
        const preOrder = await this.prisma.preOrder.findUnique({
          where: { id: submission.preOrderId },
        });
        allowed = preOrder?.sellerId === userId;
      }
    }
    if (!allowed) throw new ForbiddenException('You cannot access this file');
    response.type(upload.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${upload.originalName.replace(/["\r\n]/g, '_')}"`,
    );
    return response.sendFile(this.storage.getPrivatePath(upload.storageKey));
  }
}
