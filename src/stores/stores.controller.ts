import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { UpdateStoreDto } from './dto/store.dto';
import { UpdateSellingCategoriesDto } from './dto/update-selling-categories.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.storesService.findAllActive(query);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('catalog.read')
  findAllAdmin() {
    return this.storesService.findAllAdmin();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMy(@CurrentUser('id') ownerId: string) {
    return this.storesService.findByOwner(ownerId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  updateMy(@Body() dto: UpdateStoreDto, @CurrentUser('id') ownerId: string) {
    return this.storesService.updateByOwner(ownerId, dto);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('catalog.manage')
  activate(@Param('id') id: string) {
    return this.storesService.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('catalog.manage')
  deactivate(@Param('id') id: string) {
    return this.storesService.setActive(id, false);
  }

  @Patch(':id/selling-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('catalog.manage')
  updateSellingCategories(
    @Param('id') id: string,
    @Body() dto: UpdateSellingCategoriesDto,
  ) {
    return this.storesService.updateCategoryAdmin(id, dto.categoryId);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }
}
