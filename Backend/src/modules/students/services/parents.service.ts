import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomInt } from 'crypto';
import { literal, Op, WhereOptions } from 'sequelize';
import { PARENT_ROLE } from '../../../common/constants';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { hashPassword } from '../../../common/utils/password';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Role } from '../../admin/entities/role.entity';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import { BulkParentLoginsDto, ParentListQueryDto } from '../dto/documents.dto';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { Student } from '../entities/student.entity';

/** Easy to read aloud / type on a phone: no 0/O, 1/l/I */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newPassword = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const validMobile = (m?: string | null) => (m && /^[6-9]\d{9}$/.test(m) ? m : null);

/** Parents of the students in the selected session, with their portal login */
@Injectable()
export class ParentsService {
  constructor(
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Role) private readonly roles: typeof Role,
    private readonly audit: AuditService,
  ) {}

  private async parentRoleId() {
    const r = await this.roles.findOne({ where: { slug: PARENT_ROLE }, attributes: ['id'] });
    if (!r) throw new BadRequestException('The Parent role is missing. Run the RBAC seeder.');
    return r.id;
  }

  async list(q: ParentListQueryDto, scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId, status: { [Op.ne]: 'left' } };
    const medium = q.mediumId ?? scope.mediumId;
    if (medium) Object.assign(where, { mediumId: medium });
    if (q.classId) Object.assign(where, { classId: q.classId });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });

    const studentWhere: WhereOptions = {};
    if (q.search) {
      const s = `%${q.search}%`;
      Object.assign(studentWhere, {
        [Op.or]: [{ name: { [Op.like]: s } }, { admissionNo: { [Op.like]: s } }, { fatherName: { [Op.like]: s } }, { motherName: { [Op.like]: s } }, { fatherMobile: { [Op.like]: s } }, { motherMobile: { [Op.like]: s } }],
      });
    }
    // A login counts only if the user still exists (not deleted)
    const LIVE = literal('(SELECT id FROM users WHERE deleted_at IS NULL)');
    const hasLogin = { parentUserId: { [Op.in]: LIVE } };
    const noLogin = { [Op.or]: [{ parentUserId: null }, { parentUserId: { [Op.notIn]: LIVE } }] };
    const loginWhere = q.login === 'with' ? hasLogin : q.login === 'without' ? noLogin : {};

    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const { rows, count } = await this.enrollments.findAndCountAll({
      where,
      attributes: ['id', 'rollNo'],
      include: [
        {
          model: Student,
          required: true,
          where: { [Op.and]: [studentWhere, loginWhere] },
          attributes: ['id', 'name', 'admissionNo', 'gender', 'photoPath', 'fatherName', 'motherName', 'fatherMobile', 'motherMobile', 'whatsappNo', 'email', 'address', 'city', 'parentUserId'],
          include: [{ model: User, as: 'parentUser', attributes: ['id', 'name', 'username', 'mobile', 'isActive', 'lastLoginAt'] }],
        },
        { model: SchoolClass, attributes: ['id', 'name', 'sortOrder'] },
        { model: Section, attributes: ['id', 'name'] },
        { model: Medium, attributes: ['id', 'name'] },
      ],
      order: [[{ model: SchoolClass, as: 'schoolClass' }, 'sortOrder', 'ASC'], ['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    // How many children each parent login covers (siblings share one login)
    const parentIds = [...new Set(rows.map((r) => r.student?.parentUserId).filter((x): x is number => !!x))];
    const kids = parentIds.length
      ? ((await this.students.findAll({ where: { parentUserId: parentIds }, attributes: ['parentUserId', [this.students.sequelize!.fn('COUNT', this.students.sequelize!.col('id')), 'n']], group: ['parentUserId'], raw: true })) as unknown as { parentUserId: number; n: number }[])
      : [];
    const kidsBy = new Map(kids.map((k) => [k.parentUserId, Number(k.n)]));

    // Summary for the whole filtered list (not just this page)
    const [withLogin, total] = await Promise.all([
      this.enrollments.count({ where, include: [{ model: Student, required: true, where: { [Op.and]: [studentWhere, hasLogin] }, attributes: [] }] }),
      this.enrollments.count({ where, include: [{ model: Student, required: true, where: studentWhere, attributes: [] }] }),
    ]);

    return {
      items: rows.map((r) => ({
        enrollmentId: r.id,
        rollNo: r.rollNo,
        className: `${r.schoolClass?.name ?? ''}${r.section ? '-' + r.section.name : ''}`,
        medium: r.medium?.name,
        student: r.student,
        children: r.student?.parentUser ? (kidsBy.get(r.student.parentUserId!) ?? 1) : 0,
      })),
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      summary: { students: total, withLogin, withoutLogin: total - withLogin },
    };
  }

  /**
   * Creates parent logins for students who have none.
   * Username = father's mobile (else mother's, else admission no). A sibling whose
   * parent already has that login is simply linked to it (one login, all children).
   * Returns the generated passwords once — they are stored hashed and cannot be shown again.
   */
  async bulkCreate(dto: BulkParentLoginsDto, actor: AuthUser) {
    const roleId = await this.parentRoleId();
    const students = await this.students.findAll({
      where: { id: dto.studentIds },
      attributes: ['id', 'name', 'admissionNo', 'fatherName', 'motherName', 'fatherMobile', 'motherMobile', 'parentUserId'],
      include: [{ model: StudentEnrollment, attributes: ['id'], required: false, include: [{ model: SchoolClass, attributes: ['name'] }, { model: Section, attributes: ['name'] }] }],
    });
    if (!students.length) throw new NotFoundException('No students found');

    const results: { studentId: number; student: string; admissionNo: string; className: string; parentName: string; username: string; password: string | null; status: 'created' | 'linked' | 'skipped'; note?: string }[] = [];
    const createdNow = new Map<string, string>(); // username → password (siblings in the same batch)

    for (const s of students) {
      const enr = s.enrollments?.[s.enrollments.length - 1];
      const className = enr ? `${enr.schoolClass?.name ?? ''}${enr.section ? '-' + enr.section.name : ''}` : '';
      const base = { studentId: s.id, student: s.name, admissionNo: s.admissionNo, className, parentName: s.fatherName || s.motherName || `Parent of ${s.name}` };
      if (s.parentUserId && (await this.users.count({ where: { id: s.parentUserId } }))) {
        results.push({ ...base, username: '', password: null, status: 'skipped', note: 'Already has a login' });
        continue;
      }
      const r = await this.ensureLogin(s, roleId, createdNow);
      results.push({ ...base, ...r });
    }

    this.audit.log({ userId: actor.id, action: 'bulk_parent_logins', entity: 'student', meta: { created: results.filter((r) => r.status === 'created').length, linked: results.filter((r) => r.status === 'linked').length } });
    return {
      created: results.filter((r) => r.status === 'created').length,
      linked: results.filter((r) => r.status === 'linked').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results,
    };
  }

  /**
   * Gives one student a parent login: links to the family's existing login (same mobile)
   * or creates a new one with a random password. Used by admission, Excel import and
   * the Parents page. `createdNow` lets siblings in one batch see the new password.
   */
  async ensureLogin(
    s: Student,
    roleId?: number,
    createdNow = new Map<string, string>(),
  ): Promise<{ username: string; password: string | null; status: 'created' | 'linked' | 'skipped'; note?: string }> {
    roleId ??= await this.parentRoleId();
    const mobile = validMobile(s.fatherMobile) ?? validMobile(s.motherMobile);
    const candidates = [mobile, s.admissionNo.replace(/[^a-zA-Z0-9._@-]/g, '-')].filter((x): x is string => !!x);
    const parentName = s.fatherName || s.motherName || `Parent of ${s.name}`;
    for (const username of candidates) {
      const existing = await this.users.findOne({ where: { username }, attributes: ['id', 'roleId', 'deletedAt'], paranoid: false });
      if (existing && !existing.getDataValue('deletedAt') && existing.roleId === roleId && username === mobile) {
        // Same mobile = same family → link the sibling to the existing parent login
        await s.update({ parentUserId: existing.id });
        return { username, password: createdNow.get(username) ?? null, status: 'linked', note: createdNow.has(username) ? 'Sibling — same login' : 'Linked to the family login (password unchanged)' };
      }
      if (existing) continue; // taken by someone else → next candidate
      const password = newPassword();
      const u = await this.users.create({ name: parentName, username, mobile, passwordHash: await hashPassword(password), roleId });
      await s.update({ parentUserId: u.id });
      createdNow.set(username, password);
      return { username, password, status: 'created' };
    }
    return { username: '', password: null, status: 'skipped', note: 'No free username (add a mobile number)' };
  }

  /** Admin edits a parent login: name, username, mobile and/or a password they choose */
  async updateLogin(userId: number, dto: { name?: string; username?: string; mobile?: string | null; password?: string }, actor: AuthUser) {
    const roleId = await this.parentRoleId();
    const u = await this.users.findByPk(userId, { attributes: ['id', 'roleId', 'name', 'username', 'mobile'] });
    if (!u || u.roleId !== roleId) throw new NotFoundException('Parent login not found');
    const patch: Record<string, unknown> = {};
    if (dto.name) patch.name = dto.name.trim();
    if (dto.mobile !== undefined) patch.mobile = dto.mobile || null;
    if (dto.username && dto.username !== u.username) {
      const taken = await this.users.count({ where: { username: dto.username, id: { [Op.ne]: userId } }, paranoid: false });
      if (taken) throw new BadRequestException('This username is already used. Please choose another one.');
      patch.username = dto.username;
    }
    if (dto.password) patch.passwordHash = await hashPassword(dto.password);
    if (!Object.keys(patch).length) throw new BadRequestException('Nothing to change');
    await this.users.update(patch, { where: { id: userId } });
    this.audit.log({ userId: actor.id, action: 'update_login', entity: 'user', entityId: userId, meta: { fields: Object.keys(patch).map((k) => (k === 'passwordHash' ? 'password' : k)) } });
    return { userId, name: patch.name ?? u.name, username: patch.username ?? u.username, password: dto.password ?? null };
  }

  /** New random password for a parent login (shown once) */
  async resetPassword(userId: number, actor: AuthUser) {
    const roleId = await this.parentRoleId();
    const u = await this.users.findByPk(userId, { attributes: ['id', 'name', 'username', 'roleId'] });
    if (!u || u.roleId !== roleId) throw new NotFoundException('Parent login not found');
    const password = newPassword();
    await this.users.update({ passwordHash: await hashPassword(password) }, { where: { id: userId } });
    this.audit.log({ userId: actor.id, action: 'reset_password', entity: 'user', entityId: userId });
    const children = await this.students.findAll({ where: { parentUserId: userId }, attributes: ['name', 'admissionNo'] });
    return { userId, name: u.name, username: u.username, password, children };
  }

  /** Turn a parent login on/off without deleting it */
  async setActive(userId: number, isActive: boolean, actor: AuthUser) {
    const roleId = await this.parentRoleId();
    const u = await this.users.findByPk(userId, { attributes: ['id', 'roleId'] });
    if (!u || u.roleId !== roleId) throw new NotFoundException('Parent login not found');
    await this.users.update({ isActive }, { where: { id: userId } });
    this.audit.log({ userId: actor.id, action: isActive ? 'enable' : 'disable', entity: 'user', entityId: userId });
    return { userId, isActive };
  }
}
