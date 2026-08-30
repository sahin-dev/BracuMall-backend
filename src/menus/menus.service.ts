import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';
import { assertOwnership } from '../common/utils/ownership.util';

@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  private async getOwnStore(ownerId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) throw new NotFoundException('You do not have a store yet');
    return store;
  }

  async create(ownerId: string, dto: CreateMenuDto) {
    const store = await this.getOwnStore(ownerId);
    if (store.mode === 'general') {
      throw new BadRequestException(
        'Enable food or hybrid mode in store settings before creating menus',
      );
    }
    return this.prisma.menu.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim(),
        autoSchedule: Boolean(dto.autoSchedule),
        availableDays: dto.availableDays || [],
        availableFrom: dto.availableFrom,
        availableUntil: dto.availableUntil,
        sortOrder: dto.sortOrder ?? 0,
        storeId: store.id,
      },
    });
  }

  async findMine(ownerId: string) {
    const store = await this.getOwnStore(ownerId);
    return this.prisma.menu.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findForStore(storeId: string) {
    return this.prisma.menu.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async assertOwnership(id: string, ownerId: string) {
    const menu = await this.prisma.menu.findUniqueOrThrow({ where: { id } });
    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: menu.storeId },
    });
    assertOwnership(store.ownerId === ownerId, 'Not your menu');
    return menu;
  }

  async update(id: string, dto: UpdateMenuDto, ownerId: string) {
    await this.assertOwnership(id, ownerId);
    return this.prisma.menu.update({
      where: { id },
      data: {
        ...dto,
        title: dto.title?.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async remove(id: string, ownerId: string) {
    await this.assertOwnership(id, ownerId);
    await this.prisma.product.updateMany({
      where: { menuId: id },
      data: { menuId: null },
    });
    return this.prisma.menu.delete({ where: { id } });
  }
}
