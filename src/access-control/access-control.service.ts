import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS, PERMISSION_CATALOG, PERMISSION_KEYS } from './permission.constants';
import { CreateAccessRoleDto, UpdateAccessRoleDto } from './dto/role.dto';

const SYSTEM_ROLES = [
  { name: 'Buyer', slug: 'buyer', accountType: UserRole.buyer, description: 'Standard marketplace buyer account.', permissions: [] },
  { name: 'Seller', slug: 'seller', accountType: UserRole.seller, description: 'Approved seller with access to store operations.', permissions: [] },
  { name: 'Administrator', slug: 'administrator', accountType: UserRole.admin, description: 'Full platform administration access.', permissions: [ALL_PERMISSIONS] },
] as const;

@Injectable()
export class AccessControlService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSystemRoles();
  }

  async ensureSystemRoles() {
    for (const role of SYSTEM_ROLES) {
      await this.prisma.accessRole.upsert({
        where: { slug: role.slug },
        create: { ...role, permissions: [...role.permissions], isSystem: true },
        update: { accountType: role.accountType, isSystem: true, permissions: [...role.permissions] },
      });
    }

    for (const accountType of [UserRole.buyer, UserRole.seller, UserRole.admin]) {
      const systemRole = await this.prisma.accessRole.findUniqueOrThrow({
        where: { slug: accountType === UserRole.admin ? 'administrator' : accountType },
      });
      await this.prisma.user.updateMany({
        where: {
          role: accountType,
          OR: [{ accessRoleId: null }, { accessRoleId: { isSet: false } }],
        },
        data: { accessRoleId: systemRole.id },
      });
    }
  }

  getPermissionCatalog() {
    return PERMISSION_CATALOG;
  }

  listRoles() {
    return this.prisma.accessRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  async getRole(id: string) {
    const role = await this.prisma.accessRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(dto: CreateAccessRoleDto) {
    const permissions = this.normalizePermissions(dto.permissions);
    this.assertPermissions(dto.accountType, permissions);
    const name = dto.name.trim();
    const slug = await this.uniqueSlug(name);
    try {
      return await this.prisma.accessRole.create({
        data: {
          name,
          slug,
          description: dto.description?.trim(),
          accountType: dto.accountType,
          permissions,
        },
      });
    } catch {
      throw new ConflictException('A role with this name already exists');
    }
  }

  async updateRole(id: string, dto: UpdateAccessRoleDto) {
    const role = await this.getRole(id);
    if (role.isSystem) throw new BadRequestException('System roles cannot be changed');
    const permissions = dto.permissions ? this.normalizePermissions(dto.permissions) : undefined;
    if (permissions) this.assertPermissions(role.accountType, permissions);
    return this.prisma.accessRole.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
      },
    });
  }

  async removeRole(id: string) {
    const role = await this.getRole(id);
    if (role.isSystem) throw new BadRequestException('System roles cannot be removed');
    if (role._count.users > 0) throw new BadRequestException('Reassign users before removing this role');
    await this.prisma.accessRole.delete({ where: { id } });
    return { success: true };
  }

  async resolveRole(roleId: string | undefined, accountType: UserRole) {
    const role = roleId
      ? await this.prisma.accessRole.findUnique({ where: { id: roleId } })
      : await this.prisma.accessRole.findUnique({
          where: { slug: accountType === UserRole.admin ? 'administrator' : accountType },
        });
    if (!role) throw new BadRequestException('Select a valid access role');
    if (role.accountType !== accountType) throw new BadRequestException(`This role can only be assigned to ${role.accountType} accounts`);
    return role;
  }

  private assertPermissions(accountType: UserRole, permissions: string[]) {
    if (accountType !== UserRole.admin && permissions.length > 0) {
      throw new BadRequestException('Administrative permissions can only be assigned to administrator roles');
    }
    const invalid = permissions.filter((permission) => !PERMISSION_KEYS.has(permission));
    if (invalid.length) throw new BadRequestException(`Unknown permissions: ${invalid.join(', ')}`);
  }

  private normalizePermissions(permissions: string[]) {
    const impliedReadPermission: Record<string, string> = {
      'users.create': 'users.read',
      'users.assign_role': 'users.read',
      'users.suspend': 'users.read',
      'roles.manage': 'roles.read',
      'seller_applications.review': 'seller_applications.read',
      'catalog.manage': 'catalog.read',
      'admin_stores.manage': 'admin_stores.read',
      'categories.manage': 'categories.read',
      'content.manage': 'content.read',
      'delivery_locations.manage': 'delivery_locations.read',
      'finance.manage': 'finance.read',
      'complaints.manage': 'complaints.read',
      'feedback.manage': 'feedback.read',
      'orders.manage': 'orders.read',
      'settings.manage': 'settings.read',
    };
    const normalized = new Set(permissions);
    for (const permission of permissions) {
      const implied = impliedReadPermission[permission];
      if (implied) normalized.add(implied);
    }
    return [...normalized];
  }

  private async uniqueSlug(name: string) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'role';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.accessRole.findUnique({ where: { slug } })) slug = `${base}-${++suffix}`;
    return slug;
  }
}
