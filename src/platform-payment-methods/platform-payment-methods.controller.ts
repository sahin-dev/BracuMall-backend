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
import { PlatformPaymentMethodsService } from './platform-payment-methods.service';
import {
  CreatePlatformPaymentMethodDto,
  UpdatePlatformPaymentMethodDto,
} from './dto/platform-payment-method.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('platform-payment-methods')
export class PlatformPaymentMethodsController {
  constructor(private readonly service: PlatformPaymentMethodsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('finance.manage')
  create(@Body() dto: CreatePlatformPaymentMethodDto) {
    return this.service.create(dto);
  }

  @Get()
  findActive() {
    return this.service.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('finance.read')
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('finance.manage')
  update(@Param('id') id: string, @Body() dto: UpdatePlatformPaymentMethodDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('finance.manage')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
