import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type FeedbackStatus } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MAX_LIST_SIZE } from '../common/utils/pagination.util';

type AttachmentInput = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

const feedbackSelect = {
  id: true,
  email: true,
  subject: true,
  description: true,
  status: true,
  isRead: true,
  attachmentOriginalName: true,
  attachmentMimeType: true,
  attachmentSize: true,
  acknowledgementSentAt: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FeedbackSelect;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    input: { email?: string; subject: string; description: string },
    attachment?: AttachmentInput,
  ) {
    const subject = input.subject.trim();
    const description = input.description.trim();
    const email = input.email?.trim().toLowerCase() || undefined;
    if (subject.length < 5 || description.length < 10) {
      throw new BadRequestException(
        'Please provide a clear subject and a little more detail',
      );
    }

    const feedback = await this.prisma.feedback.create({
      data: {
        email,
        subject,
        description,
        ...(attachment
          ? {
              attachmentStorageKey: attachment.storageKey,
              attachmentOriginalName: attachment.originalName,
              attachmentMimeType: attachment.mimeType,
              attachmentSize: attachment.size,
            }
          : {}),
      },
      select: feedbackSelect,
    });

    await this.notifications
      .notifyAdmins({
        type: 'feedback_new',
        title: 'New feedback received',
        body: subject,
        link: '/admin/feedback',
      })
      .catch((error) =>
        console.error('[feedback] Could not notify administrators', error),
      );

    let acknowledgementEmailSent = false;
    if (email) {
      acknowledgementEmailSent = await this.sendAcknowledgement(
        email,
        feedback.id,
      );
      if (acknowledgementEmailSent) {
        await this.prisma.feedback.update({
          where: { id: feedback.id },
          data: { acknowledgementSentAt: new Date() },
        });
      }
    }

    return {
      id: feedback.id,
      reference: this.reference(feedback.id),
      acknowledgementEmailSent,
      message: 'Thank you — your feedback has been received.',
    };
  }

  findAll(query: { status?: FeedbackStatus; search?: string }) {
    const search = query.search?.trim();
    const where: Prisma.FeedbackWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.feedback.findMany({
      where,
      select: feedbackSelect,
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST_SIZE,
    });
  }

  async stats() {
    const [total, unread, fresh, inReview, resolved] = await Promise.all([
      this.prisma.feedback.count(),
      this.prisma.feedback.count({ where: { isRead: false } }),
      this.prisma.feedback.count({ where: { status: 'new' } }),
      this.prisma.feedback.count({ where: { status: 'in_review' } }),
      this.prisma.feedback.count({ where: { status: 'resolved' } }),
    ]);
    return { total, unread, new: fresh, inReview, resolved };
  }

  findById(id: string) {
    return this.prisma.feedback.findUniqueOrThrow({
      where: { id },
      select: feedbackSelect,
    });
  }

  update(id: string, input: { status?: FeedbackStatus; adminNote?: string }) {
    return this.prisma.feedback.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.adminNote !== undefined
          ? { adminNote: input.adminNote.trim() || null }
          : {}),
      },
      select: feedbackSelect,
    });
  }

  markRead(id: string) {
    return this.prisma.feedback.update({
      where: { id },
      data: { isRead: true },
      select: feedbackSelect,
    });
  }

  async getAttachment(id: string) {
    const feedback = await this.prisma.feedback.findUniqueOrThrow({
      where: { id },
    });
    if (
      !feedback.attachmentStorageKey ||
      !feedback.attachmentOriginalName ||
      !feedback.attachmentMimeType
    ) {
      throw new BadRequestException('This feedback has no attachment');
    }
    return {
      storageKey: feedback.attachmentStorageKey,
      originalName: feedback.attachmentOriginalName,
      mimeType: feedback.attachmentMimeType,
    };
  }

  private reference(id: string) {
    return `FB-${id.slice(-8).toUpperCase()}`;
  }

  private async sendAcknowledgement(email: string, id: string) {
    const host = this.config.get<string>('SMTP_HOST');
    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('MAIL_FROM') ||
      this.config.get<string>('SMTP_USER');
    if (!host || !from) {
      console.warn(
        `[feedback-email] SMTP is not configured; acknowledgement for ${this.reference(id)} was not sent`,
      );
      return false;
    }

    const settings = await this.prisma.platformSettings.findFirst();
    const siteName = settings?.siteName || 'BracuMall';
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    const smtpSecure = this.config.get<string>('SMTP_SECURE');
    const secure = smtpSecure === 'true' || smtpSecure === '1' || port === 465;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const reference = this.reference(id);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: `We received your feedback — ${reference}`,
        text: `Thank you for helping improve ${siteName}. We received your feedback (${reference}) and our team will review it.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:600px;margin:auto">
            <div style="background:#0f766e;color:white;padding:24px;border-radius:12px 12px 0 0">
              <h1 style="font-size:22px;margin:0">Thank you for your feedback</h1>
            </div>
            <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 12px 12px">
              <p>We received your message and our team will review it carefully.</p>
              <p style="background:#f0fdfa;padding:12px 16px;border-radius:8px"><strong>Reference:</strong> ${reference}</p>
              <p>Your feedback helps us make ${this.escapeHtml(siteName)} better for everyone.</p>
              <p style="color:#64748b;font-size:13px;margin-top:24px">This is an automatic confirmation; you do not need to reply.</p>
            </div>
          </div>
        `,
      });
      return true;
    } catch (error) {
      console.error('[feedback-email] Could not send acknowledgement', error);
      return false;
    }
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character] || character,
    );
  }
}
