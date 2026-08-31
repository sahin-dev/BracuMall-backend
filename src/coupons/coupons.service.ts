import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnership } from '../common/utils/ownership.util';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';
import type { Coupon } from '@prisma/client';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  private async getOwnStore(ownerId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) throw new NotFoundException('You do not have a store yet');
    return store;
  }

  async create(ownerId: string, dto: CreateCouponDto) {
    const store = await this.getOwnStore(ownerId);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId: store.id, code } },
    });
    if (existing) throw new BadRequestException('You already have a coupon with this code');
    return this.prisma.coupon.create({
      data: {
        storeId: store.id,
        code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderValue: dto.minOrderValue,
        maxRedemptions: dto.maxRedemptions,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async findMine(ownerId: string) {
    const store = await this.getOwnStore(ownerId);
    return this.prisma.coupon.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForStore(storeId: string) {
    return this.prisma.coupon.findMany({
      where: { storeId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOwnedCoupon(id: string, ownerId: string) {
    const coupon = await this.prisma.coupon.findUniqueOrThrow({ where: { id } });
    const store = await this.prisma.store.findUniqueOrThrow({ where: { id: coupon.storeId } });
    assertOwnership(store.ownerId === ownerId, 'Not your coupon');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto, ownerId: string) {
    await this.assertOwnedCoupon(id, ownerId);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async remove(id: string, ownerId: string) {
    await this.assertOwnedCoupon(id, ownerId);
    return this.prisma.coupon.delete({ where: { id } });
  }

  /** Throws with a buyer-facing message if the coupon can't be applied; otherwise returns the coupon and the computed discount. */
  async findRedeemable(
    storeId: string,
    rawCode: string,
    subtotal: number,
  ): Promise<{ coupon: Coupon; discountAmount: number }> {
    const code = rawCode.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code } },
    });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (!coupon.isActive) throw new BadRequestException('This coupon is no longer active');
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now)
      throw new BadRequestException('This coupon is not active yet');
    if (coupon.expiresAt && coupon.expiresAt < now)
      throw new BadRequestException('This coupon has expired');
    if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions)
      throw new BadRequestException('This coupon has reached its redemption limit');
    if (coupon.minOrderValue != null && subtotal < coupon.minOrderValue)
      throw new BadRequestException(`This coupon requires a minimum order of Tk ${coupon.minOrderValue}`);

    const discountAmount = Math.min(
      coupon.discountType === 'percentage'
        ? (subtotal * coupon.discountValue) / 100
        : coupon.discountValue,
      subtotal,
    );
    return { coupon, discountAmount };
  }

  async validate(storeId: string, code: string, subtotal: number) {
    const { coupon, discountAmount } = await this.findRedeemable(storeId, code, subtotal);
    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
    };
  }
}
