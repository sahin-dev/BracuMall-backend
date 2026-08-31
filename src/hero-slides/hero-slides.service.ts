import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeroSlideDto, UpdateHeroSlideDto } from './dto/hero-slide.dto';

@Injectable()
export class HeroSlidesService {
  constructor(private prisma: PrismaService) {}

  findActive() {
    return this.prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findAllAdmin() {
    return this.prisma.heroSlide.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  create(dto: CreateHeroSlideDto) {
    return this.prisma.heroSlide.create({ data: dto });
  }

  update(id: string, dto: UpdateHeroSlideDto) {
    return this.prisma.heroSlide.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.heroSlide.delete({ where: { id } });
  }
}
