import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { SUPER_ADMIN_ROLE } from '../../../common/constants';
import { AuthUser } from '../../../common/interfaces/request-context';
import { hashPassword } from '../../../common/utils/password';
import { paginate } from '../../../common/utils/paginate';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from '../dto/user.dto';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { AuditService } from './audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Role) private readonly roles: typeof Role,
    private readonly audit: AuditService,
  ) {}

  list(query: UserQueryDto) {
    const where: WhereOptions = {};
    if (query.roleId) Object.assign(where, { roleId: query.roleId });
    if (query.search) {
      const s = `%${query.search}%`;
      Object.assign(where, { [Op.or]: [{ name: { [Op.like]: s } }, { username: { [Op.like]: s } }, { mobile: { [Op.like]: s } }] });
    }
    return paginate(
      this.users,
      query,
      { where, include: [{ model: Role, attributes: ['id', 'name', 'slug'] }] },
      ['id', 'name', 'username', 'createdAt', 'lastLoginAt'],
    );
  }

  async findOne(id: number) {
    const user = await this.users.findByPk(id, { include: [{ model: Role, attributes: ['id', 'name', 'slug'] }] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    await this.assertRole(dto.roleId, actor);
    const { password, ...rest } = dto;
    try {
      const user = await this.users.create({ ...rest, passwordHash: await hashPassword(password) });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'user', entityId: user.id });
      return this.findOne(user.id);
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Username or email already exists');
      throw e;
    }
  }

  async update(id: number, dto: UpdateUserDto, actor: AuthUser) {
    const user = await this.findOne(id);
    if (dto.roleId) await this.assertRole(dto.roleId, actor);
    if (id === actor.id && dto.isActive === false) throw new BadRequestException('You cannot deactivate yourself');

    const { password, ...rest } = dto;
    const patch: Partial<User> = { ...rest };
    if (password) patch.passwordHash = await hashPassword(password);
    try {
      await user.update(patch);
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Username or email already exists');
      throw e;
    }
    this.audit.log({ userId: actor.id, action: 'update', entity: 'user', entityId: id, meta: { fields: Object.keys(rest) } });
    return this.findOne(id);
  }

  async remove(id: number, actor: AuthUser) {
    if (id === actor.id) throw new BadRequestException('You cannot delete yourself');
    const user = await this.findOne(id);
    if (user.role?.slug === SUPER_ADMIN_ROLE && actor.roleSlug !== SUPER_ADMIN_ROLE) {
      throw new BadRequestException('Only a super admin can delete a super admin');
    }
    await user.destroy(); // soft delete (paranoid)
    this.audit.log({ userId: actor.id, action: 'delete', entity: 'user', entityId: id });
    return { id };
  }

  /** Non-super-admins may not create/assign the super admin role */
  private async assertRole(roleId: number, actor: AuthUser) {
    const role = await this.roles.findByPk(roleId);
    if (!role) throw new BadRequestException('Role not found');
    if (role.slug === SUPER_ADMIN_ROLE && actor.roleSlug !== SUPER_ADMIN_ROLE) {
      throw new BadRequestException('Only a super admin can assign the super admin role');
    }
  }
}
