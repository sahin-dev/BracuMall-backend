import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

function contextFor(user: Record<string, unknown>) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardFor(roles?: string[], permissions?: string[]) {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === ROLES_KEY) return roles;
      if (key === PERMISSIONS_KEY) return permissions;
      return undefined;
    },
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard permission policies', () => {
  it('allows endpoints without role metadata', () => {
    expect(guardFor().canActivate(contextFor({ role: 'buyer' }))).toBe(true);
  });

  it('rejects an incompatible account type', () => {
    expect(guardFor(['admin']).canActivate(contextFor({ role: 'seller' }))).toBe(false);
  });

  it('keeps seller account-type checks independent of admin permissions', () => {
    expect(
      guardFor(['seller', 'admin'], ['orders.manage']).canActivate(
        contextFor({ role: 'seller', permissions: [] }),
      ),
    ).toBe(true);
  });

  it('allows a full administrator wildcard policy', () => {
    expect(
      guardFor(['admin'], ['users.read', 'users.create']).canActivate(
        contextFor({ role: 'admin', permissions: ['*'] }),
      ),
    ).toBe(true);
  });

  it('requires every declared permission for an administrator', () => {
    const guard = guardFor(['admin'], ['users.read', 'users.create']);
    expect(guard.canActivate(contextFor({ role: 'admin', permissions: ['users.read'] }))).toBe(false);
    expect(guard.canActivate(contextFor({ role: 'admin', permissions: ['users.read', 'users.create'] }))).toBe(true);
  });
});
