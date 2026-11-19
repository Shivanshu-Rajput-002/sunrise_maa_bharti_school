import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SUPER_ADMIN_ROLE } from '../../../common/constants';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Subject } from '../../academic/entities/subject.entity';
import { Role } from '../../admin/entities/role.entity';
import { FeePayment } from '../../fees/entities/fee.entities';
import { Certificate } from '../../students/entities/certificate.entity';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../admin/entities/user.entity';
import { RbacService } from '../../admin/services/rbac.service';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { NoticesService } from '../../communication/services/notices.service';
import { FeeCollectionService } from '../../fees/services/fee-collection.service';
import { StaffService } from '../../staff/services/staff.service';
import { StudentsService } from '../../students/services/students.service';

/**
 * Dashboard for the active scope (session + medium). Each block is included only
 * if the user may see that module — an accountant sees fees, a teacher sees attendance.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    @InjectModel(Medium) private readonly mediums: typeof Medium,
    @InjectModel(SchoolClass) private readonly classes: typeof SchoolClass,
    @InjectModel(Section) private readonly sections: typeof Section,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(FeePayment) private readonly payments: typeof FeePayment,
    @InjectModel(Certificate) private readonly certificates: typeof Certificate,
    private readonly studentsService: StudentsService,
    private readonly feesService: FeeCollectionService,
    private readonly attendanceService: AttendanceService,
    private readonly notices: NoticesService,
    private readonly rbac: RbacService,
    private readonly staffService: StaffService,
  ) {}

  async summary(scope: RequestScope, user: AuthUser) {
    const perms = user.roleSlug === SUPER_ADMIN_ROLE ? null : await this.rbac.getPermissionKeys(user.roleId);
    const can = (p: string) => perms === null || perms.has(p);

    const [session, medium, classes, sections, subjects, staff, usersByRole, students, fees, attendance, notices] = await Promise.all([
      this.sessions.findByPk(scope.sessionId, { attributes: ['id', 'name', 'startDate', 'endDate', 'isCurrent'] }),
      scope.mediumId ? this.mediums.findByPk(scope.mediumId, { attributes: ['id', 'code', 'name'] }) : null,
      this.classes.count({ where: { isActive: true } }),
      this.sections.count({ where: { isActive: true } }),
      this.subjects.count({ where: { isActive: true } }),
      // Staff = active records in the staff directory
      this.staffService.countActive(),
      can('users.view')
        ? this.users.findAll({
            attributes: ['roleId', [this.users.sequelize!.fn('COUNT', this.users.sequelize!.col('User.id')), 'count']],
            include: [{ model: Role, attributes: ['name', 'slug'] }],
            where: { isActive: true },
            group: ['roleId', 'role.id'],
            raw: true,
            nest: true,
          })
        : [],
      can('students.view') ? this.studentsService.stats(scope) : null,
      can('fees.view') ? this.feesService.summary(scope) : null,
      can('attendance.view') ? this.attendanceService.today(scope) : null,
      this.notices.forStaff(scope.sessionId),
    ]);
    const [recent, staffToday] = await Promise.all([this.recentActivity(scope, can), can('staff.view') ? this.staffService.today() : null]);

    return {
      scope: { session, medium },
      counts: { classes, sections, subjects, staff },
      students,
      fees,
      attendance,
      notices,
      recent,
      staffToday,
      usersByRole: (usersByRole as unknown as { count: number; role: { name: string; slug: string } }[]).map((r) => ({
        role: r.role.name,
        slug: r.role.slug,
        count: Number(r.count),
      })),
    };
  }

  /** Latest admissions, fee receipts and certificates in this session (only what the user may see) */
  private async recentActivity(scope: RequestScope, can: (p: string) => boolean) {
    const enrWhere: Record<string, unknown> = { sessionId: scope.sessionId };
    const payWhere: Record<string, unknown> = { sessionId: scope.sessionId };
    if (scope.mediumId) {
      enrWhere.mediumId = scope.mediumId;
      payWhere.mediumId = scope.mediumId;
    }
    const LIMIT = 8;

    const [admissions, payments, certs] = await Promise.all([
      can('students.view')
        ? this.enrollments.findAll({
            where: { ...enrWhere, enrollmentType: 'new' },
            attributes: ['id', 'createdAt'],
            include: [
              { model: Student, attributes: ['id', 'name', 'admissionNo'], required: true },
              { model: SchoolClass, attributes: ['name'] },
              { model: Section, attributes: ['name'] },
            ],
            order: [['createdAt', 'DESC']],
            limit: LIMIT,
          })
        : [],
      can('fees.view')
        ? this.payments.findAll({
            where: payWhere,
            attributes: ['id', 'receiptNo', 'netAmount', 'mode', 'status', 'createdAt'],
            include: [{ model: Student, attributes: ['id', 'name'] }, { model: User, as: 'collector', attributes: ['name'] }],
            order: [['createdAt', 'DESC']],
            limit: LIMIT,
          })
        : [],
      can('students.certificates')
        ? this.certificates.findAll({
            where: { sessionId: scope.sessionId },
            attributes: ['id', 'type', 'serialNo', 'studentId', 'createdAt'],
            include: [{ model: Student, attributes: ['id', 'name'] }, { model: User, as: 'issuer', attributes: ['name'] }],
            order: [['createdAt', 'DESC']],
            limit: LIMIT,
          })
        : [],
    ]);
    const CERT: Record<string, string> = { character: 'Character certificate', study: 'Study certificate', transfer: 'Transfer certificate' };
    const items = [
      ...admissions.map((e) => ({
        type: 'admission',
        at: e.createdAt,
        title: `New admission · ${e.student?.name ?? ''}`,
        detail: `${e.student?.admissionNo ?? ''} · Class ${e.schoolClass?.name ?? ''}${e.section ? '-' + e.section.name : ''}`,
        studentId: e.student?.id,
      })),
      ...payments.map((p) => ({
        type: p.status === 'cancelled' ? 'cancelled' : 'payment',
        at: p.createdAt,
        title: `${p.status === 'cancelled' ? 'Receipt cancelled' : 'Fee collected'} · ${p.student?.name ?? ''}`,
        detail: `${p.receiptNo} · Rs. ${Number(p.netAmount).toLocaleString('en-IN')} · ${p.mode.toUpperCase()}${p.collector ? ` · by ${p.collector.name}` : ''}`,
        amount: Number(p.netAmount),
        paymentId: p.id,
        studentId: p.student?.id,
      })),
      ...certs.map((c) => ({
        type: 'certificate',
        at: c.createdAt,
        title: `${CERT[c.type] ?? 'Certificate'} · ${c.student?.name ?? ''}`,
        detail: `${c.serialNo}${c.issuer ? ` · by ${c.issuer.name}` : ''}`,
        certificateId: c.id,
        studentId: c.studentId,
      })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);
  }
}
