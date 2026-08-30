import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StoreFavoritesService } from './store-favorites.service';
import { CreateStoreFavoriteDto } from './dto/create-store-favorite.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('store-favorites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('buyer', 'seller')
export class StoreFavoritesController {
  constructor(private readonly storeFavoritesService: StoreFavoritesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  add(@Body() dto: CreateStoreFavoriteDto, @CurrentUser('id') userId: string) {
    return this.storeFavoritesService.add(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser('id') userId: string) {
    return this.storeFavoritesService.findAll(userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.storeFavoritesService.remove(id, userId);
  }
}
