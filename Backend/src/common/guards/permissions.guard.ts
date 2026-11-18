import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../../modules/admin/services/rbac.service';
import { PERMISSIONS_KEY, SUPER_ADMIN_ROLE } from '../constants';
import { AppRequest } from '../interfaces/request-context';

/** Global guard: enforces @Permissions(...) metadata. Super admin bypasses. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<AppRequest>();
    if (!user) return false;
    if (user.roleSlug === SUPER_ADMIN_ROLE) return true;

    const granted = await this.rbac.getPermissionKeys(user.roleId);
    if (required.every((p) => granted.has(p))) return true;
    throw new ForbiddenException('You do not have permission for this action');
  }
}
