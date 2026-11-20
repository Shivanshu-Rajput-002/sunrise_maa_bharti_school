import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError } from 'sequelize';
import { SUPER_ADMIN_ROLE, PARENT_ROLE } from '../../../common/constants';
import { AuthUser } from '../../../common/interfaces/request-context';
import { CreateRoleDto, SetRolePermissionsDto } from '../dto/role.dto';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { AuditService } from './audit.service';
import { RbacService } from './rbac.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role) private readonly roles: typeof Role,
    @InjectModel(Permission) private readonly permissions: typeof Permission,
    @InjectModel(RolePermission) private readonly rolePerms: typeof RolePermission,
    @InjectModel(User) private readonly users: typeof User,
    private readonly sequelize: Sequelize,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const roles = await this.roles.findAll({
      include: [{ model: Permission, attributes: ['key'], through: { attributes: [] } }],
      order: [['id', 'ASC']],
    });
    const counts = (await this.users.count({ group: ['roleId'] })) as unknown as { roleId: number; count: number }[];
    const countMap = new Map(counts.map((c) => [c.roleId, Number(c.count)]));
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      isSystem: r.isSystem,
      userCount: countMap.get(r.id) ?? 0,
      permissions: r.slug === SUPER_ADMIN_ROLE ? ['*'] : (r.permissions ?? []).map((p) => p.key),
    }));
  }

  /** Permission catalogue grouped by module, for the permission matrix UI */
  async catalogue() {
    const all = await this.permissions.findAll({ attributes: ['key', 'module'], order: [['id', 'ASC']] });
    const grouped: Record<string, string[]> = {};
    for (const p of all) (grouped[p.module] ||= []).push(p.key);
    return grouped;
  }

  async create(dto: CreateRoleDto, actor: AuthUser) {
    try {
      const role = await this.roles.create({ ...dto, isSystem: false });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'role', entityId: role.id });
      return role;
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Role slug already exists');
      throw e;
    }
  }

  async setPermissions(id: number, dto: SetRolePermissionsDto, actor: AuthUser) {
    const role = await this.get(id);
    if (role.slug === SUPER_ADMIN_ROLE) throw new BadRequestException('Super admin always has all permissions');
    if (role.slug === PARENT_ROLE) throw new BadRequestException('Parent permissions are locked to the parent portal and cannot be changed.');

    const perms = await this.permissions.findAll({ where: { key: dto.permissions }, attributes: ['id', 'key'] });
    if (perms.length !== dto.permissions.length) throw new BadRequestException('Unknown permission key in list');

    await this.sequelize.transaction(async (transaction) => {
      await this.rolePerms.destroy({ where: { roleId: id }, transaction });
      await this.rolePerms.bulkCreate(
        perms.map((p) => ({ roleId: id, permissionId: p.id })),
        { transaction },
      );
    });
    this.rbac.invalidate(id);
    this.audit.log({ userId: actor.id, action: 'update', entity: 'role_permissions', entityId: id, meta: { count: perms.length } });
    return { id, permissions: dto.permissions };
  }

  async remove(id: number, actor: AuthUser) {
    const role = await this.get(id);
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (await this.users.count({ where: { roleId: id } })) throw new BadRequestException('Role is assigned to users');
    await role.destroy();
    this.rbac.invalidate(id);
    this.audit.log({ userId: actor.id, action: 'delete', entity: 'role', entityId: id });
    return { id };
  }

  private async get(id: number) {
    const role = await this.roles.findByPk(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
