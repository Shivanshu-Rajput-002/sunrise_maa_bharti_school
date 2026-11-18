import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';

/**
 * Role → permission keys, cached in memory (roles change rarely).
 * Call invalidate() whenever a role's permissions change.
 */
@Injectable()
export class RbacService {
  private cache = new Map<number, Set<string>>();

  constructor(@InjectModel(Role) private readonly roles: typeof Role) {}

  async getPermissionKeys(roleId: number): Promise<Set<string>> {
    const hit = this.cache.get(roleId);
    if (hit) return hit;

    const role = await this.roles.findByPk(roleId, {
      include: [{ model: Permission, attributes: ['key'], through: { attributes: [] } }],
    });
    const keys = new Set((role?.permissions ?? []).map((p) => p.key));
    this.cache.set(roleId, keys);
    return keys;
  }

  invalidate(roleId?: number) {
    if (roleId) this.cache.delete(roleId);
    else this.cache.clear();
  }
}
