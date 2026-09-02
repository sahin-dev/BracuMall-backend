import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminCreateUserDto, AssignAccessRoleDto } from './dto/admin-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @Permissions('dashboard.read')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users/options')
  @Permissions('users.create')
  getUserCreationOptions() {
    return this.adminService.getUserCreationOptions();
  }

  @Get('users/:id/role-options')
  @Permissions('users.assign_role')
  getRoleOptions(@Param('id') id: string) {
    return this.adminService.getRoleOptions(id);
  }

  @Get('users/:id')
  @Permissions('users.read')
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/suspend')
  @Permissions('users.suspend')
  suspend(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.adminService.setSuspended(id, true, reason);
  }

  @Patch('users/:id/reactivate')
  @Permissions('users.suspend')
  reactivate(@Param('id') id: string) {
    return this.adminService.setSuspended(id, false);
  }

  @Post('users')
  @Permissions('users.create')
  createUser(@Body() dto: AdminCreateUserDto, @CurrentUser('id') actorId: string) {
    return this.adminService.createUser(dto, actorId);
  }

  @Patch('users/:id/access-role')
  @Permissions('users.assign_role')
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignAccessRoleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.adminService.assignAccessRole(id, dto.accessRoleId, actorId);
  }
}
