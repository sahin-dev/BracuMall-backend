import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PreOrdersService } from './pre-orders.service';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { UpdatePreOrderStatusDto } from './dto/update-pre-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('pre-orders')
export class PreOrdersController {
  constructor(private readonly preOrdersService: PreOrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  create(@Body() dto: CreatePreOrderDto, @CurrentUser('id') buyerId: string) {
    return this.preOrdersService.create(dto, buyerId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  findMy(@CurrentUser('id') userId: string) {
    return this.preOrdersService.findByBuyer(userId);
  }

  @Get('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Permissions('orders.read')
  findByProduct(
    @Param('productId') productId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.preOrdersService.findByProduct(productId, userId, role === 'admin');
  }

  @Get('my-store')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findForMyStore(@CurrentUser('id') sellerId: string) {
    return this.preOrdersService.findBySeller(sellerId);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('orders.read')
  findAll() {
    return this.preOrdersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller', 'admin')
  @Permissions('orders.read')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.preOrdersService.findById(id, userId, role);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  cancelMyPreOrder(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.preOrdersService.cancelByBuyer(id, userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Permissions('orders.manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePreOrderStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.preOrdersService.updateStatus(
      id,
      dto.status,
      userId,
      role === 'admin',
    );
  }
}
