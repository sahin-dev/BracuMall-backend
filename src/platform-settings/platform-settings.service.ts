import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/platform-settings.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const existing = await this.prisma.platformSettings.findFirst();
    if (existing) return existing;
    return this.prisma.platformSettings.create({ data: {} });
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    const settings = await this.getSettings();
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: {
        siteName: dto.siteName?.trim(),
        logoUrl: dto.logoUrl,
        defaultPostpaidDepositPercent: dto.defaultPostpaidDepositPercent,
      },
    });
  }
}
