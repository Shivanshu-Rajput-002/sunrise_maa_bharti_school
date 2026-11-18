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
import { User } from '../../admin/entities/user.entity';
import { RbacService } from '../../admin/services/rbac.service';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { NoticesService } from '../../communication/services/notices.service';
import { FeeCollectionService } from '../../fees/services/fee-collection.service';
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
    private readonly studentsService: StudentsService,
    private readonly feesService: FeeCollectionService,
    private readonly attendanceService: AttendanceService,
    private readonly notices: NoticesService,
    private readonly rbac: RbacService,
  ) {}

  async summary(scope: RequestScope, user: AuthUser) {
    const perms = user.roleSlug === SUPER_ADMIN_ROLE ? null : await this.rbac.getPermissionKeys(user.roleId);
    const can = (p: string) => perms === null || perms.has(p);

    const [session, medium, classes, sections, subjects, usersByRole, students, fees, attendance, notices] = await Promise.all([
      this.sessions.findByPk(scope.sessionId, { attributes: ['id', 'name', 'startDate', 'endDate', 'isCurrent'] }),
      scope.mediumId ? this.mediums.findByPk(scope.mediumId, { attributes: ['id', 'code', 'name'] }) : null,
      this.classes.count({ where: { isActive: true } }),
      this.sections.count({ where: { isActive: true } }),
      this.subjects.count({ where: { isActive: true } }),
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

    return {
      scope: { session, medium },
      counts: { classes, sections, subjects },
      students,
      fees,
      attendance,
      notices,
      usersByRole: (usersByRole as unknown as { count: number; role: { name: string; slug: string } }[]).map((r) => ({
        role: r.role.name,
        slug: r.role.slug,
        count: Number(r.count),
      })),
    };
  }
}
