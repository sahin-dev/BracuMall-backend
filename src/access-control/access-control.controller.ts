import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { CreateAccessRoleDto, UpdateAccessRoleDto } from './dto/role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/access-control')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AccessControlController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Get('permissions')
  @Permissions('roles.read')
  permissions() { return this.accessControl.getPermissionCatalog(); }

  @Get('roles')
  @Permissions('roles.read')
  roles() { return this.accessControl.listRoles(); }

  @Post('roles')
  @Permissions('roles.manage')
  create(@Body() dto: CreateAccessRoleDto) { return this.accessControl.createRole(dto); }

  @Patch('roles/:id')
  @Permissions('roles.manage')
  update(@Param('id') id: string, @Body() dto: UpdateAccessRoleDto) { return this.accessControl.updateRole(id, dto); }

  @Delete('roles/:id')
  @Permissions('roles.manage')
  remove(@Param('id') id: string) { return this.accessControl.removeRole(id); }
}
