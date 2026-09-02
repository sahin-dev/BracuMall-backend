import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';
import { CreateAdminStoreDto, SetStorePriorityDto, UpdateAdminStoreDto } from './dto/admin-store.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';

// Admin-managed storefronts: stores the platform runs itself. They use the
// same Store/Product models and render identically to buyers — the only
// difference is `isAdminManaged`, which the ranking layer uses to boost them
// (see ProductsService.findAll / StoresService.findAllActive) and which gates
// pre-order eligibility (see ProductsService.assertPreOrderAllowed).
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminStoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
  ) {}

  @Get('stores')
  @Permissions('admin_stores.read')
  list() {
    return this.storesService.findAdminManagedStores();
  }

  @Post('stores')
  @Permissions('admin_stores.manage')
  create(@Body() dto: CreateAdminStoreDto, @CurrentUser('id') adminId: string) {
    return this.storesService.createAdminStore(adminId, dto);
  }

  @Get('stores/:id')
  @Permissions('admin_stores.read')
  getOne(@Param('id') id: string) {
    return this.storesService.getAdminManagedStoreOrThrow(id);
  }

  @Patch('stores/:id')
  @Permissions('admin_stores.manage')
  update(@Param('id') id: string, @Body() dto: UpdateAdminStoreDto) {
    return this.storesService.updateAdminStore(id, { ...dto });
  }

  @Patch('stores/:id/priority')
  @Permissions('admin_stores.manage')
  setPriority(@Param('id') id: string, @Body() dto: SetStorePriorityDto) {
    return this.storesService.setAdminManaged(id, dto.isAdminManaged);
  }

  @Get('stores/:id/products')
  @Permissions('admin_stores.read')
  products(@Param('id') id: string) {
    return this.productsService.findByStoreForAdmin(id);
  }

  @Post('stores/:id/products')
  @Permissions('admin_stores.manage')
  createProduct(@Param('id') id: string, @Body() dto: CreateProductDto) {
    return this.productsService.createForAdminStore(id, dto);
  }

  @Patch('products/:id')
  @Permissions('admin_stores.manage')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateForAdmin(id, dto);
  }

  @Delete('products/:id')
  @Permissions('admin_stores.manage')
  removeProduct(@Param('id') id: string) {
    return this.productsService.removeForAdmin(id);
  }
}
