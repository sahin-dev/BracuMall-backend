import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SellerApplicationsService } from './seller-applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { RequestInfoDto } from './dto/request-info.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('seller-applications')
export class SellerApplicationsController {
  constructor(
    private readonly applicationsService: SellerApplicationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  create(@Body() dto: CreateApplicationDto, @CurrentUser('id') userId: string) {
    return this.applicationsService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('seller_applications.read')
  findAll(@Query('status') status?: string) {
    return this.applicationsService.findAll(status);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  findMy(@CurrentUser('id') userId: string) {
    return this.applicationsService.findByUser(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('seller_applications.read')
  findOne(@Param('id') id: string) {
    return this.applicationsService.findById(id);
  }

  @Patch(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('seller_applications.review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.applicationsService.review(id, dto, adminId);
  }

  @Patch(':id/request-info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('seller_applications.review')
  requestInfo(
    @Param('id') id: string,
    @Body() dto: RequestInfoDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.applicationsService.requestInfo(id, dto.note, adminId);
  }

  @Patch(':id/resubmit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer')
  resubmit(
    @Param('id') id: string,
    @Body() dto: CreateApplicationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.applicationsService.resubmit(id, dto, userId);
  }
}
