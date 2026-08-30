import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('menus')
export class MenusController {
  constructor(private readonly service: MenusService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  create(@Body() dto: CreateMenuDto, @CurrentUser('id') ownerId: string) {
    return this.service.create(ownerId, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMine(@CurrentUser('id') ownerId: string) {
    return this.service.findMine(ownerId);
  }

  @Get()
  findForStore(@Query('storeId') storeId: string) {
    return this.service.findForStore(storeId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
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
