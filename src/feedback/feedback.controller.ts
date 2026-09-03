import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { FeedbackService } from './feedback.service';
import {
  CreateFeedbackDto,
  FeedbackQueryDto,
  UpdateFeedbackDto,
} from './dto/feedback.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../uploads/storage/storage.interface';

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Post()
  @Throttle({
    default: { limit: 5, ttl: 10 * 60_000, blockDuration: 10 * 60_000 },
  })
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_ATTACHMENT_MIMES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Attachment must be a JPG, PNG, WEBP, or PDF file',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Body() dto: CreateFeedbackDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let attachment:
      | {
          storageKey: string;
          originalName: string;
          mimeType: string;
          size: number;
        }
      | undefined;
    if (file) {
      const { fileTypeFromBuffer } = await import('file-type');
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !ALLOWED_ATTACHMENT_MIMES.includes(detected.mime)) {
        throw new BadRequestException(
          'Attachment content does not match an allowed file type',
        );
      }
      attachment = {
        storageKey: await this.storage.savePrivate(file),
        originalName: file.originalname,
        mimeType: detected.mime,
        size: file.size,
      };
    }
    return this.feedbackService.create(dto, attachment);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('feedback.read')
  stats() {
    return this.feedbackService.stats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('feedback.read')
  findAll(@Query() query: FeedbackQueryDto) {
    return this.feedbackService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('feedback.read')
  findOne(@Param('id') id: string) {
    return this.feedbackService.findById(id);
  }

  @Get(':id/attachment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('feedback.read')
  async attachment(@Param('id') id: string, @Res() response: Response) {
    const attachment = await this.feedbackService.getAttachment(id);
    response.type(attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalName.replace(/["\r\n]/g, '_')}"`,
    );
    return response.sendFile(
      this.storage.getPrivatePath(attachment.storageKey),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('feedback.manage')
  update(@Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedbackService.update(id, dto);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('feedback.read')
  markRead(@Param('id') id: string) {
    return this.feedbackService.markRead(id);
  }
}
