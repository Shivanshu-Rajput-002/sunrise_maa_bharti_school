import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomBytes } from 'crypto';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE } from '../../../common/constants';
import { AuthUser } from '../../../common/interfaces/request-context';
import { hashPassword, verifyPassword } from '../../../common/utils/password';
import { ScopeService } from '../../academic/services/scope.service';
import { SessionsService } from '../../academic/services/sessions.service';
import { Role } from '../../admin/entities/role.entity';
import { User } from '../../admin/entities/user.entity';
import { SettingsService } from '../../admin/services/settings.service';
import { AuditService } from '../../admin/services/audit.service';
import { RbacService } from '../../admin/services/rbac.service';
import { ChangePasswordDto, LoginDto } from '../dto/auth.dto';
import { RefreshToken } from '../entities/refresh-token.entity';

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(RefreshToken) private readonly tokens: typeof RefreshToken,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly scope: ScopeService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  /** Public data for the login screen: school name + logo, active sessions, current session */
  async loginOptions() {
    const [sessions, current, school] = await Promise.all([this.sessions.list(true), this.sessions.current(), this.settings.get('school')]);
    return { sessions, currentSessionId: current?.id ?? null, school: { name: school.name, tagline: school.tagline, logoPath: school.logoPath } };
  }

  async login(dto: LoginDto, client: ClientInfo) {
    const user = await this.users.scope('withPassword').findOne({
      where: { username: dto.username },
      include: [{ model: Role, attributes: ['id', 'slug', 'name'] }],
    });
    // Same message for unknown user / wrong password — no username enumeration
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    // No session picked at login → start in the current session (switchable from the dashboard)
    const sessionId = dto.sessionId ?? (await this.sessions.current())?.id;
    if (!sessionId || !(await this.scope.isValidSession(sessionId))) throw new BadRequestException('No academic session is set up yet');

    await user.update({ lastLoginAt: new Date() });
    this.audit.log({ userId: user.id, sessionId, action: 'login', entity: 'auth', ip: client.ip });

    return this.issueTokens(user, sessionId, client);
  }

  /** Rotates the refresh token. Re-use of a revoked token revokes the whole family (theft detection). */
  async refresh(rawToken: string | undefined, sessionId: number | undefined, client: ClientInfo) {
    if (!rawToken) throw new UnauthorizedException('Login required');
    const record = await this.tokens.findOne({ where: { tokenHash: sha256(rawToken) } });
    if (!record) throw new UnauthorizedException('Login required');

    if (record.revokedAt) {
      await this.tokens.update({ revokedAt: new Date() }, { where: { userId: record.userId, revokedAt: null } });
      throw new UnauthorizedException('Session expired, please login again');
    }
    if (record.expiresAt < new Date()) throw new UnauthorizedException('Session expired, please login again');

    const user = await this.users.findByPk(record.userId, { include: [{ model: Role, attributes: ['id', 'slug', 'name'] }] });
    if (!user || !user.isActive) throw new UnauthorizedException('Account is disabled');

    const sid =
      sessionId && (await this.scope.isValidSession(sessionId)) ? sessionId : (await this.sessions.current())?.id;
    if (!sid) throw new BadRequestException('No active academic session');

    await record.update({ revokedAt: new Date() });
    return this.issueTokens(user, sid, client);
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) await this.tokens.update({ revokedAt: new Date() }, { where: { tokenHash: sha256(rawToken), revokedAt: null } });
    return { ok: true };
  }

  async me(auth: AuthUser) {
    const user = await this.users.findByPk(auth.id, { include: [{ model: Role, attributes: ['id', 'slug', 'name'] }] });
    if (!user) throw new UnauthorizedException();
    return { user: this.publicUser(user), permissions: await this.permissionsFor(user) };
  }

  async changePassword(auth: AuthUser, dto: ChangePasswordDto) {
    const user = await this.users.scope('withPassword').findByPk(auth.id);
    if (!user || !(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await user.update({ passwordHash: await hashPassword(dto.newPassword) });
    // Sign out all other devices
    await this.tokens.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null } });
    this.audit.log({ userId: user.id, action: 'change_password', entity: 'user', entityId: user.id });
    return { ok: true };
  }

  // ---------- helpers ----------
  private async issueTokens(user: User, sessionId: number, client: ClientInfo) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      rid: user.roleId,
      role: user.role!.slug,
      sid: sessionId,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.get<number>('jwt.refreshDays', 7);
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    await this.tokens.create({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt,
      ip: client.ip?.slice(0, 45) ?? null,
      userAgent: client.userAgent?.slice(0, 255) ?? null,
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      sessionId,
      user: this.publicUser(user),
      permissions: await this.permissionsFor(user),
    };
  }

  private async permissionsFor(user: User): Promise<string[]> {
    if (user.role?.slug === SUPER_ADMIN_ROLE) return ALL_PERMISSIONS;
    return [...(await this.rbac.getPermissionKeys(user.roleId))];
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      role: user.role ? { id: user.role.id, slug: user.role.slug, name: user.role.name } : null,
    };
  }
}
