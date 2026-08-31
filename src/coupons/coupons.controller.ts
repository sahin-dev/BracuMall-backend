import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly service: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  create(@Body() dto: CreateCouponDto, @CurrentUser('id') ownerId: string) {
    return this.service.create(ownerId, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMine(@CurrentUser('id') ownerId: string) {
    return this.service.findMine(ownerId);
  }

  @Get('store/:storeId')
  findForStore(@Param('storeId') storeId: string) {
    return this.service.findForStore(storeId);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  validate(@Body() dto: ValidateCouponDto) {
    return this.service.validate(dto.storeId, dto.code, dto.subtotal);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.service.update(id, dto, ownerId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  remove(@Param('id') id: string, @CurrentUser('id') ownerId: string) {
    return this.service.remove(id, ownerId);
  }
}
