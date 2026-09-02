import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ALL_PERMISSIONS } from '../../access-control/permission.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user.role)) return false;

    // Permission policies currently scope administrative capabilities. Buyer and
    // seller endpoints keep their existing account-type checks and ownership rules.
    if (user.role !== 'admin') return true;
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) return true;
    const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    return permissions.includes(ALL_PERMISSIONS) || requiredPermissions.every((permission) => permissions.includes(permission));
  }
}
