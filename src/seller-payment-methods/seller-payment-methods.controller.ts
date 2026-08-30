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
import { SellerPaymentMethodsService } from './seller-payment-methods.service';
import {
  CreateSellerPaymentMethodDto,
  UpdateSellerPaymentMethodDto,
} from './dto/seller-payment-method.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('seller-payment-methods')
export class SellerPaymentMethodsController {
  constructor(private readonly service: SellerPaymentMethodsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  create(
    @Body() dto: CreateSellerPaymentMethodDto,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.service.create(ownerId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMine(@CurrentUser('id') ownerId: string) {
    return this.service.findMine(ownerId);
  }

  @Get('store/:storeId')
  findForStore(@Param('storeId') storeId: string) {
    return this.service.findForStore(storeId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSellerPaymentMethodDto,
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
