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
import { CartService } from './cart.service';
import { AddCartItemDto, CheckoutDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('buyer', 'seller')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getMine(@CurrentUser('id') userId: string) {
    return this.cartService.getMine(userId);
  }

  @Post('items')
  addItem(@Body() dto: AddCartItemDto, @CurrentUser('id') userId: string) {
    return this.cartService.addItem(userId, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.cartService.updateItem(id, userId, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.cartService.removeItem(id, userId);
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) {
    return this.cartService.clear(userId);
  }

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto, @CurrentUser('id') userId: string) {
    return this.cartService.checkout(userId, dto);
  }
}
