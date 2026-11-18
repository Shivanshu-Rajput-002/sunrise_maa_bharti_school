import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { NoticesService } from '../../communication/services/notices.service';
import { ExamsService } from '../../exams/services/exams.service';
import { FeePayment } from '../../fees/entities/fee.entities';
import { FeeCollectionService } from '../../fees/services/fee-collection.service';
import { FeeLedgerService } from '../../fees/services/fee-ledger.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { Bus } from '../../transport/entities/transport.entities';

/**
 * Read-only views for parents. EVERY call goes through childEnrollment(), which
 * proves the student belongs to the logged-in parent — a parent can never read
 * another family's data, even by guessing ids.
 */
@Injectable()
export class PortalService {
  constructor(
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(FeePayment) private readonly payments: typeof FeePayment,
    @InjectModel(Bus) private readonly busModel: typeof Bus,
    private readonly ledger: FeeLedgerService,
    private readonly feeCollection: FeeCollectionService,
    private readonly attendance: AttendanceService,
    private readonly exams: ExamsService,
    private readonly notices: NoticesService,
  ) {}

  async children(user: AuthUser, scope: RequestScope) {
    const kids = await this.students.findAll({
      where: { parentUserId: user.id },
      attributes: ['id', 'name', 'admissionNo', 'photoPath', 'gender', 'dob', 'status'],
      include: [
        {
          model: StudentEnrollment,
          where: { sessionId: scope.sessionId },
          required: false,
          include: [
            { model: SchoolClass, attributes: ['id', 'name'] },
            { model: Section, attributes: ['id', 'name'] },
            { model: Medium, attributes: ['id', 'name'] },
          ],
        },
      ],
      order: [['name', 'ASC']],
    });
    return kids.map((k) => {
      const { enrollments, ...rest } = k.toJSON() as Record<string, unknown> & { enrollments?: unknown[] };
      return { ...rest, enrollment: enrollments?.[0] ?? null };
    });
  }

  async fees(studentId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    const [ledger, receipts] = await Promise.all([
      this.ledger.forEnrollment(enr.id, scope.sessionId),
      this.payments.findAll({
        where: { enrollmentId: enr.id, status: 'paid' },
        attributes: ['id', 'receiptNo', 'paymentDate', 'netAmount', 'mode'],
        order: [['paymentDate', 'DESC']],
      }),
    ]);
    const { enrollment: _e, ...rest } = ledger;
    return { ...rest, receipts };
  }

  async receiptPdf(studentId: number, paymentId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    const p = await this.payments.findOne({ where: { id: paymentId, enrollmentId: enr.id, status: 'paid' } });
    if (!p) throw new NotFoundException('Receipt not found');
    return this.feeCollection.receiptPdf(paymentId, scope);
  }

  async attendanceSummary(studentId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    return this.attendance.studentSummary(enr.id, scope.sessionId);
  }

  async results(studentId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    return this.exams.reportCard(enr.id, scope.sessionId, { publishedOnly: true });
  }

  async reportCardPdf(studentId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    return this.exams.reportCardPdf([enr.id], scope.sessionId, { publishedOnly: true });
  }

  async examSchedule(studentId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    return this.exams.examsForClass(scope.sessionId, enr.classId);
  }

  async admitCardPdf(studentId: number, examId: number, user: AuthUser, scope: RequestScope) {
    const enr = await this.childEnrollment(studentId, user, scope);
    return this.exams.admitCardsPdf(examId, { classId: enr.classId, mediumId: enr.mediumId }, scope, enr.id);
  }

  async noticesFor(user: AuthUser, scope: RequestScope) {
    const enrs = await this.enrollments.findAll({
      where: { sessionId: scope.sessionId },
      attributes: ['classId'],
      include: [{ model: Student, attributes: [], where: { parentUserId: user.id }, required: true }],
    });
    return this.notices.forParents(scope.sessionId, [...new Set(enrs.map((e) => e.classId))]);
  }

  /** Bus GPS links — only for families whose child uses school transport */
  async buses(user: AuthUser, scope: RequestScope) {
    const uses = await this.enrollments.count({
      where: { sessionId: scope.sessionId, usesTransport: true },
      include: [{ model: Student, attributes: [], where: { parentUserId: user.id }, required: true }],
    });
    if (!uses) return [];
    return this.busModel.findAll({ where: { isActive: true }, attributes: ['id', 'busNo', 'stops', 'driverName', 'driverMobile', 'gpsUrl'], order: [['busNo', 'ASC']] });
  }

  private async childEnrollment(studentId: number, user: AuthUser, scope: RequestScope) {
    const student = await this.students.findOne({ where: { id: studentId, parentUserId: user.id }, attributes: ['id'] });
    if (!student) throw new ForbiddenException('This student is not linked to your account');
    const enr = await this.enrollments.findOne({ where: { studentId, sessionId: scope.sessionId } });
    if (!enr) throw new NotFoundException('Not enrolled in the selected session');
    return enr;
  }
}
