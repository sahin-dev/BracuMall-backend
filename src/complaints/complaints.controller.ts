import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintResponseDto } from './dto/complaint.dto';
import { CreateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  create(@Body() dto: CreateComplaintDto, @CurrentUser('id') userId: string) {
    return this.complaintsService.create(dto, userId);
  }

  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.complaintsService.findMine(userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Permissions('complaints.read')
  findAll(@Query('status') status?: string) {
    return this.complaintsService.findAll(status);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('buyer', 'seller', 'admin')
  @Permissions('complaints.read')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.complaintsService.findById(id, userId, role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Permissions('complaints.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateComplaintStatusDto, @CurrentUser('id') adminId: string) {
    return this.complaintsService.updateStatus(id, dto, adminId);
  }

  @Patch(':id/respond')
  @UseGuards(JwtAuthGuard)
  respond(
    @Param('id') id: string,
    @Body() dto: ComplaintResponseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.complaintsService.respond(id, userId, dto.response);
  }
}
