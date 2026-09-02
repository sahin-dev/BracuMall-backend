import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  create(@Body() dto: CreateOrderDto, @CurrentUser('id') buyerId: string) {
    return this.ordersService.create(dto, buyerId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  findMy(@CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    if (role === 'seller') {
      return this.ordersService.findBySeller(userId);
    }
    return this.ordersService.findByBuyer(userId);
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  findMyPurchases(@CurrentUser('id') userId: string) {
    return this.ordersService.findByBuyer(userId);
  }

  @Get('sales')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMySales(@CurrentUser('id') userId: string) {
    return this.ordersService.findBySeller(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('orders.read')
  findAll() {
    return this.ordersService.findAll();
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
    return this.ordersService.findById(id, userId, role);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller', 'admin')
  @Permissions('orders.read')
  findHistory(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.ordersService.findHistory(id, userId, role);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  cancelMyOrder(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancelByBuyer(id, userId, reason);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @Permissions('orders.manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.ordersService.updateStatus(id, dto, userId, role === 'admin');
  }
}
