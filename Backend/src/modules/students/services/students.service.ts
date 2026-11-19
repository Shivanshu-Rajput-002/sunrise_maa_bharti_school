import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { SUPER_ADMIN_ROLE } from '../../../common/constants';
import { InjectModel } from '@nestjs/sequelize';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Op, Transaction, UniqueConstraintError, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { SequenceService } from '../../../database/sequence.service';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import {
  AssignRollsDto,
  CreateStudentDto,
  PromoteDto,
  StudentQueryDto,
  UpdateStatusDto,
  UpdateStudentDto,
} from '../dto/student.dto';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { Student } from '../entities/student.entity';
import { ParentsService } from './parents.service';

const ENROLLMENT_FIELDS = ['classId', 'sectionId', 'mediumId', 'rollNo', 'isHostel', 'usesTransport', 'transportRouteId'] as const;

const enrollmentInclude = [
  { model: SchoolClass, attributes: ['id', 'name', 'nameHi'] },
  { model: Section, attributes: ['id', 'name'] },
  { model: Medium, attributes: ['id', 'code', 'name'] },
];

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(SchoolClass) private readonly classes: typeof SchoolClass,
    @InjectModel(Section) private readonly sections: typeof Section,
    @InjectModel(AcademicSession) private readonly sessionsModel: typeof AcademicSession,
    private readonly sequelize: Sequelize,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
    private readonly parents: ParentsService,
  ) {}

  /**
   * Students enrolled in the active session (+ medium). Always scoped — a student
   * from another session can never appear here.
   */
  async list(scope: RequestScope, q: StudentQueryDto) {
    const where: WhereOptions = { sessionId: scope.sessionId };
    const mediumId = q.mediumId ?? scope.mediumId;
    if (mediumId) Object.assign(where, { mediumId });
    if (q.classId) Object.assign(where, { classId: q.classId });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });
    if (q.enrollmentStatus) Object.assign(where, { status: q.enrollmentStatus });

    const studentWhere: WhereOptions = {};
    if (q.gender) Object.assign(studentWhere, { gender: q.gender });
    if (q.search) {
      const s = `%${q.search}%`;
      Object.assign(studentWhere, {
        [Op.or]: [
          { name: { [Op.like]: s } },
          { admissionNo: { [Op.like]: s } },
          { fatherName: { [Op.like]: s } },
          { fatherMobile: { [Op.like]: s } },
        ],
      });
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const sortMap: Record<string, any> = {
      name: [{ model: Student, as: 'student' }, 'name'],
      admissionNo: [{ model: Student, as: 'student' }, 'admissionNo'],
      rollNo: ['rollNo'],
      createdAt: ['createdAt'],
    };
    const dir = (q.sortDir || 'ASC').toUpperCase();
    const order: any[] = q.sortBy && sortMap[q.sortBy]
      ? [[...sortMap[q.sortBy], dir]]
      : [[{ model: SchoolClass, as: 'schoolClass' }, 'sortOrder', 'ASC'], ['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']];

    const { rows, count } = await this.enrollments.findAndCountAll({
      where,
      include: [
        {
          model: Student,
          where: studentWhere,
          required: true,
          attributes: ['id', 'admissionNo', 'name', 'gender', 'dob', 'fatherName', 'fatherMobile', 'photoPath', 'status'],
        },
        ...enrollmentInclude,
      ],
      order,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return { items: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
  }

  /** Full profile with enrollment history across all sessions */
  async findOne(id: number, scope: RequestScope) {
    const student = await this.students.findByPk(id, {
      include: [
        { model: User, as: 'parentUser', attributes: ['id', 'name', 'username', 'mobile'] },
        {
          model: StudentEnrollment,
          include: [...enrollmentInclude, { model: AcademicSession, attributes: ['id', 'name', 'startDate'] }],
        },
      ],
      order: [[{ model: StudentEnrollment, as: 'enrollments' }, { model: AcademicSession, as: 'session' }, 'startDate', 'DESC']],
    });
    if (!student) throw new NotFoundException('Student not found');
    const current = student.enrollments?.find((e) => e.sessionId === scope.sessionId) ?? null;
    return { ...student.toJSON(), currentEnrollment: current };
  }

  async admit(dto: CreateStudentDto, scope: RequestScope, actor: AuthUser) {
    const mediumId = dto.mediumId ?? scope.mediumId;
    if (!mediumId) throw new BadRequestException('Select a medium (Hindi / English) for the admission');
    await this.assertClassSection(dto.classId, dto.sectionId);

    const { classId, sectionId, rollNo, isHostel, usesTransport, transportRouteId, mediumId: _m, ...profile } = dto;
    await this.assertRoute(transportRouteId, scope.sessionId);

    try {
      const student = await this.sequelize.transaction(async (t) => {
        await this.assertRollFree({ sessionId: scope.sessionId, mediumId, classId, sectionId: sectionId ?? null, rollNo }, undefined, t);
        const admissionNo = profile.admissionNo || (await this.nextAdmissionNo(dto.admissionDate, t));
        const s = await this.students.create({ ...profile, admissionNo }, { transaction: t });
        await this.enrollments.create(
          {
            studentId: s.id,
            sessionId: scope.sessionId,
            mediumId,
            classId,
            sectionId: sectionId ?? null,
            rollNo: rollNo ?? null,
            isHostel: !!isHostel,
            usesTransport: !!usesTransport || !!transportRouteId,
            transportRouteId: transportRouteId ?? null,
            enrollmentType: 'new',
          },
          { transaction: t },
        );
        return s;
      });
      this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'student', entityId: student.id });
      // Parent portal login is created (or the family login linked) right away
      const parentLogin = await this.parents.ensureLogin(student).catch(() => ({ username: '', password: null, status: 'skipped' as const, note: 'Could not create the parent login' }));
      const full = await this.findOne(student.id, scope);
      return { ...full, parentLogin };
    } catch (e) {
      throw this.mapUnique(e);
    }
  }

  async update(id: number, dto: UpdateStudentDto, scope: RequestScope, actor: AuthUser) {
    const student = await this.students.findByPk(id);
    if (!student) throw new NotFoundException('Student not found');

    const profile: Record<string, unknown> = {};
    const enrollmentPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if ((ENROLLMENT_FIELDS as readonly string[]).includes(k)) enrollmentPatch[k] = v;
      else profile[k] = v;
    }

    try {
      await this.sequelize.transaction(async (t) => {
        if (Object.keys(profile).length) await student.update(profile, { transaction: t });
        if (Object.keys(enrollmentPatch).length) {
          const enr = await this.enrollments.findOne({ where: { studentId: id, sessionId: scope.sessionId }, transaction: t });
          if (!enr) throw new BadRequestException('Student is not enrolled in the selected session');
          const classId = (enrollmentPatch.classId as number) ?? enr.classId;
          const sectionId = 'sectionId' in enrollmentPatch ? (enrollmentPatch.sectionId as number | null) : enr.sectionId;
          // Changing class without picking a new section clears the (now invalid) section
          if (enrollmentPatch.classId && enrollmentPatch.classId !== enr.classId && !('sectionId' in enrollmentPatch)) {
            enrollmentPatch.sectionId = null;
          }
          if ('transportRouteId' in enrollmentPatch) {
            await this.assertRoute(enrollmentPatch.transportRouteId as number | null, scope.sessionId);
            enrollmentPatch.usesTransport = !!enrollmentPatch.transportRouteId;
          }
          const finalSection = 'sectionId' in enrollmentPatch ? (enrollmentPatch.sectionId as number | null) : sectionId;
          await this.assertClassSection(classId, finalSection);
          await this.assertRollFree(
            {
              sessionId: scope.sessionId,
              mediumId: (enrollmentPatch.mediumId as number) ?? enr.mediumId,
              classId,
              sectionId: finalSection,
              rollNo: 'rollNo' in enrollmentPatch ? (enrollmentPatch.rollNo as number | null) : enr.rollNo,
            },
            enr.id,
            t,
          );
          await enr.update(enrollmentPatch, { transaction: t });
        }
      });
    } catch (e) {
      throw this.mapUnique(e);
    }
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'student', entityId: id, meta: { fields: Object.keys(dto) } });
    return this.findOne(id, scope);
  }

  async updateStatus(id: number, dto: UpdateStatusDto, scope: RequestScope, actor: AuthUser) {
    const student = await this.students.findByPk(id);
    if (!student) throw new NotFoundException('Student not found');
    const leaving = dto.status !== 'active';
    try {
      await this.sequelize.transaction(async (t) => {
        await student.update(
          {
            status: dto.status,
            leavingDate: leaving ? (dto.leavingDate ?? new Date().toISOString().slice(0, 10)) : null,
            leavingReason: leaving ? (dto.leavingReason ?? null) : null,
            tcNo: dto.status === 'tc_issued' ? (dto.tcNo ?? null) : student.tcNo,
          },
          { transaction: t },
        );
        await this.enrollments.update(
          { status: leaving ? 'left' : 'studying' },
          { where: { studentId: id, sessionId: scope.sessionId }, transaction: t },
        );
      });
    } catch (e) {
      throw this.mapUnique(e);
    }
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'status', entity: 'student', entityId: id, meta: { status: dto.status } });
    return this.findOne(id, scope);
  }

  /** What is attached to a student — any of these means the record must be kept */
  private async usage(studentId: number) {
    const [row] = await this.sequelize.query<{ fees: number; attendance: number; marks: number; certificates: number }>(
      `SELECT
        (SELECT COUNT(*) FROM fee_payments WHERE student_id = :id) AS fees,
        (SELECT COUNT(*) FROM attendance a JOIN student_enrollments e ON e.id = a.enrollment_id WHERE e.student_id = :id) AS attendance,
        (SELECT COUNT(*) FROM exam_marks m JOIN student_enrollments e ON e.id = m.enrollment_id WHERE e.student_id = :id) AS marks,
        (SELECT COUNT(*) FROM certificates WHERE student_id = :id) AS certificates`,
      { replacements: { id: studentId }, type: QueryTypes.SELECT },
    );
    return { fees: Number(row.fees), attendance: Number(row.attendance), marks: Number(row.marks), certificates: Number(row.certificates) };
  }

  /**
   * Delete is only for a wrong / duplicate admission: super admin only, and only while the
   * student has no fee receipt, attendance, marks or certificate. Everyone else uses
   * status (Left / TC issued). Deleted students go to the Recycle Bin (restorable).
   */
  async remove(id: number, actor: AuthUser) {
    if (actor.roleSlug !== SUPER_ADMIN_ROLE) throw new ForbiddenException('Only the super admin can delete a student. Use "Change status" → Left instead.');
    const student = await this.students.findByPk(id);
    if (!student) throw new NotFoundException('Student not found');
    const u = await this.usage(id);
    const used = [u.fees && `${u.fees} fee receipt(s)`, u.attendance && `${u.attendance} attendance day(s)`, u.marks && `${u.marks} exam mark(s)`, u.certificates && `${u.certificates} certificate(s)`].filter(Boolean);
    if (used.length) {
      throw new BadRequestException(`${student.name} cannot be deleted because the school has records for this student (${used.join(', ')}). Use "Change status" → Left or issue a TC instead.`);
    }
    await student.destroy(); // soft delete → Recycle Bin
    this.audit.log({ userId: actor.id, action: 'delete', entity: 'student', entityId: id, meta: { name: student.name, admissionNo: student.admissionNo } });
    return { id };
  }

  /** Recycle Bin: students deleted in the last 30 days */
  async recycleBin(actor: AuthUser) {
    if (actor.roleSlug !== SUPER_ADMIN_ROLE) throw new ForbiddenException('Only the super admin can open the Recycle Bin.');
    const since = new Date(Date.now() - 30 * 86400_000);
    const rows = await this.students.findAll({
      paranoid: false,
      where: { deletedAt: { [Op.gte]: since } },
      attributes: ['id', 'name', 'admissionNo', 'fatherName', 'fatherMobile', 'deletedAt'],
      include: [{ model: StudentEnrollment, attributes: ['id', 'sessionId'], include: [{ model: SchoolClass, attributes: ['name'] }, { model: Section, attributes: ['name'] }] }],
      order: [['deletedAt', 'DESC']],
    });
    return rows.map((s) => {
      const e = [...(s.enrollments ?? [])].sort((a, b) => b.sessionId - a.sessionId)[0];
      const deletedAt = s.getDataValue('deletedAt') as Date;
      return {
        id: s.id,
        name: s.name,
        admissionNo: s.admissionNo,
        fatherName: s.fatherName,
        fatherMobile: s.fatherMobile,
        className: e ? `${e.schoolClass?.name ?? ''}${e.section ? '-' + e.section.name : ''}` : '',
        deletedAt,
        daysLeft: Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400_000)),
      };
    });
  }

  async restore(id: number, actor: AuthUser) {
    if (actor.roleSlug !== SUPER_ADMIN_ROLE) throw new ForbiddenException('Only the super admin can restore a student.');
    const s = await this.students.findByPk(id, { paranoid: false });
    if (!s || !s.getDataValue('deletedAt')) throw new NotFoundException('This student is not in the Recycle Bin');
    await s.restore();
    this.audit.log({ userId: actor.id, action: 'restore', entity: 'student', entityId: id, meta: { name: s.name, admissionNo: s.admissionNo } });
    return { id, name: s.name };
  }

  /** Re-number a class/section 1..n by name or admission number */
  async assignRolls(dto: AssignRollsDto, scope: RequestScope, actor: AuthUser) {
    const where = {
      sessionId: scope.sessionId,
      mediumId: dto.mediumId,
      classId: dto.classId,
      sectionId: dto.sectionId ?? null,
      status: 'studying',
    };
    const rows = await this.enrollments.findAll({
      where,
      include: [{ model: Student, attributes: ['name', 'admissionNo'], required: true }],
      order: [[{ model: Student, as: 'student' }, dto.orderBy === 'name' ? 'name' : 'admissionNo', 'ASC']],
    });
    if (!rows.length) throw new BadRequestException('No students found in this class');

    await this.sequelize.transaction(async (t) => {
      // Clear first so the unique (…, roll_no) index never sees a temporary duplicate
      await this.enrollments.update({ rollNo: null }, { where, transaction: t });
      for (let i = 0; i < rows.length; i++) {
        await this.enrollments.update({ rollNo: i + 1 }, { where: { id: rows[i].id }, transaction: t });
      }
    });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'assign_rolls', entity: 'class', entityId: dto.classId, meta: { count: rows.length } });
    return { updated: rows.length };
  }

  /**
   * Year-end promotion: creates enrollments in the target session and marks the
   * current ones promoted/detained. Idempotent — students already enrolled in the
   * target session are skipped.
   */
  async promote(dto: PromoteDto, scope: RequestScope, actor: AuthUser) {
    if (dto.toSessionId === scope.sessionId) throw new BadRequestException('Target session must be different');
    const [target, current] = await Promise.all([
      this.sessionsModel.findByPk(dto.toSessionId),
      this.sessionsModel.findByPk(scope.sessionId),
    ]);
    if (!target || !target.isActive) throw new BadRequestException('Target session not found or inactive');
    if (current && target.startDate <= current.startDate) throw new BadRequestException('Promote only into a later session');
    await this.assertClassSection(dto.toClassId, dto.toSectionId);

    const source = await this.enrollments.findAll({
      where: { id: dto.enrollmentIds, sessionId: scope.sessionId, status: 'studying' },
    });
    if (!source.length) throw new BadRequestException('No eligible students selected');

    const already = await this.enrollments.findAll({
      where: { sessionId: dto.toSessionId, studentId: source.map((e) => e.studentId) },
      attributes: ['studentId'],
    });
    const skip = new Set(already.map((e) => e.studentId));
    const todo = source.filter((e) => !skip.has(e.studentId));

    await this.sequelize.transaction(async (t) => {
      if (todo.length) {
        await this.enrollments.bulkCreate(
          todo.map((e) => ({
            studentId: e.studentId,
            sessionId: dto.toSessionId,
            mediumId: e.mediumId,
            classId: dto.toClassId,
            sectionId: dto.toSectionId ?? null,
            rollNo: null,
            isHostel: e.isHostel,
            usesTransport: e.usesTransport,
            enrollmentType: dto.detain ? 'detained' : 'promoted',
          })),
          { transaction: t },
        );
      }
      await this.enrollments.update(
        { status: dto.detain ? 'detained' : 'promoted' },
        { where: { id: source.map((e) => e.id) }, transaction: t },
      );
    });

    this.audit.log({
      userId: actor.id,
      sessionId: scope.sessionId,
      action: dto.detain ? 'detain' : 'promote',
      entity: 'student_enrollment',
      meta: { toSessionId: dto.toSessionId, toClassId: dto.toClassId, moved: todo.length, skipped: skip.size },
    });
    return { moved: todo.length, skipped: skip.size };
  }

  async setPhoto(id: number, file: Express.Multer.File, actor: AuthUser) {
    const student = await this.students.findByPk(id);
    if (!student) throw new NotFoundException('Student not found');
    const old = student.photoPath;
    await student.update({ photoPath: `images/students/${file.filename}` });
    if (old) fs.unlink(join(process.cwd(), 'uploads', old)).catch(() => undefined);
    this.audit.log({ userId: actor.id, action: 'update', entity: 'student_photo', entityId: id });
    return { photoPath: student.photoPath };
  }

  /** Headline numbers for the dashboard, in the active scope */
  async stats(scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId, status: { [Op.ne]: 'left' } };
    if (scope.mediumId) Object.assign(where, { mediumId: scope.mediumId });

    const [total, byGender, byClass, newAdmissions, classGender] = await Promise.all([
      this.enrollments.count({ where }),
      this.enrollments.findAll({
        where,
        attributes: [[this.sequelize.col('student.gender'), 'gender'], [this.sequelize.fn('COUNT', this.sequelize.col('StudentEnrollment.id')), 'count']],
        include: [{ model: Student, attributes: [], required: true }],
        group: ['student.gender'],
        raw: true,
      }),
      this.enrollments.findAll({
        where,
        attributes: ['classId', [this.sequelize.fn('COUNT', this.sequelize.col('StudentEnrollment.id')), 'count']],
        include: [{ model: SchoolClass, attributes: ['name', 'sortOrder'] }],
        group: ['classId', 'schoolClass.id'],
        order: [[{ model: SchoolClass, as: 'schoolClass' }, 'sortOrder', 'ASC']],
        raw: true,
        nest: true,
      }),
      this.enrollments.count({ where: { ...where, enrollmentType: 'new' } }),
      this.enrollments.findAll({
        where,
        attributes: ['classId', [this.sequelize.col('student.gender'), 'gender'], [this.sequelize.fn('COUNT', this.sequelize.col('StudentEnrollment.id')), 'count']],
        include: [{ model: Student, attributes: [], required: true }],
        group: ['classId', 'student.gender'],
        raw: true,
      }),
    ]);
    const genderOf = (classId: number, g: string) =>
      Number((classGender as any[]).find((r) => r.classId === classId && r.gender === g)?.count ?? 0);

    return {
      total,
      newAdmissions,
      byGender: Object.fromEntries((byGender as any[]).map((r) => [r.gender, Number(r.count)])),
      byClass: (byClass as any[]).map((r) => ({
        classId: r.classId,
        name: r.schoolClass.name,
        count: Number(r.count),
        boys: genderOf(r.classId, 'male'),
        girls: genderOf(r.classId, 'female'),
      })),
    };
  }

  // ---------- helpers ----------
  /** Admission no format: <YEAR>/<4-digit sequence>, e.g. 2026/0042 */
  private async nextAdmissionNo(admissionDate: string, t: Transaction) {
    const year = new Date(admissionDate).getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const n = await this.sequences.next(`admission:${year}`, t);
      const candidate = `${year}/${String(n).padStart(4, '0')}`;
      // A manually entered number may already use this slot — skip it
      const taken = await this.students.count({ where: { admissionNo: candidate }, paranoid: false, transaction: t });
      if (!taken) return candidate;
    }
    throw new ConflictException('Could not generate admission number, please retry');
  }

  /** DB unique index ignores NULL section_id, so check roll clashes explicitly */
  private async assertRollFree(
    p: { sessionId: number; mediumId: number; classId: number; sectionId: number | null; rollNo: number | null | undefined },
    excludeId?: number,
    transaction?: Transaction,
  ) {
    if (!p.rollNo) return;
    const clash = await this.enrollments.count({
      where: {
        sessionId: p.sessionId,
        mediumId: p.mediumId,
        classId: p.classId,
        sectionId: p.sectionId ?? null,
        rollNo: p.rollNo,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      transaction,
    });
    if (clash) throw new ConflictException(`Roll number ${p.rollNo} is already taken in this class`);
  }

  private async assertRoute(routeId: number | null | undefined, sessionId: number) {
    if (!routeId) return;
    const [rows] = (await this.sequelize.query('SELECT id FROM transport_routes WHERE id = ? AND session_id = ? AND is_active = 1', {
      replacements: [routeId, sessionId],
    })) as [unknown[], unknown];
    if (!rows.length) throw new BadRequestException('Transport route not found in this session');
  }

  private async assertClassSection(classId: number, sectionId?: number | null) {
    const cls = await this.classes.findByPk(classId, { attributes: ['id', 'isActive'] });
    if (!cls || !cls.isActive) throw new BadRequestException('Class not found or inactive');
    if (sectionId) {
      const sec = await this.sections.findOne({ where: { id: sectionId, classId }, attributes: ['id'] });
      if (!sec) throw new BadRequestException('Section does not belong to the selected class');
    }
  }

  private mapUnique(e: unknown) {
    if (e instanceof UniqueConstraintError) {
      const field = Object.keys(e.fields ?? {}).join(',');
      if (field.includes('admission_no')) return new ConflictException('Admission number already exists');
      if (field.includes('aadhar')) return new ConflictException('Aadhar number already belongs to another student');
      if (field.includes('apaar')) return new ConflictException('APAAR ID already belongs to another student');
      if (field.includes('tc_no')) return new ConflictException('TC number already used');
      if (field.includes('biometric')) return new ConflictException('Biometric ID already belongs to another student');
      if (field.includes('roll') || e.message.includes('enr_unique_roll')) return new ConflictException('Roll number already taken in this class');
      if (field.includes('student_id')) return new ConflictException('Student is already enrolled in this session');
      return new ConflictException('Duplicate value');
    }
    return e;
  }
}
