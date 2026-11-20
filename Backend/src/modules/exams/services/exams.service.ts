import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { toMoney } from '../../../common/utils/money';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Subject } from '../../academic/entities/subject.entity';
import { AuditService } from '../../admin/services/audit.service';
import { GradeBand, SettingsService } from '../../admin/services/settings.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { ClassQueryDto, CreateExamDto, MarksQueryDto, SaveMarksDto, SaveScheduleDto, UpdateExamDto } from '../dto/exam.dto';
import { Exam, ExamMark, ExamSchedule } from '../entities/exam.entities';
import { ExamPrintService } from './exam-print.service';

const gradeFor = (pct: number, bands: GradeBand[]) => bands.find((b) => pct >= b.min)?.grade ?? '-';
export { fullMax, markValue } from './exam-utils';
import { fullMax, markValue } from './exam-utils';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Exam) private readonly exams: typeof Exam,
    @InjectModel(ExamSchedule) private readonly schedules: typeof ExamSchedule,
    @InjectModel(ExamMark) private readonly marks: typeof ExamMark,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly sequelize: Sequelize,
    private readonly print: ExamPrintService,
  ) {}

  // ---------- exams ----------
  list(scope: RequestScope) {
    return this.exams.findAll({ where: { sessionId: scope.sessionId }, order: [['startDate', 'ASC'], ['id', 'ASC']] });
  }

  /** A marksheet column can be filled by only one exam per session */
  private async assertColumnFree(sessionId: number, col: string | null | undefined, exceptId?: number, field: 'reportColumn' | 'reportColumnEn' = 'reportColumn') {
    if (!col) return;
    const other = await this.exams.findOne({ where: { sessionId, [field]: col, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) }, attributes: ['name'] });
    if (other) throw new BadRequestException(`Marksheet column ${col} is already used by "${other.name}"`);
  }

  async create(dto: CreateExamDto, scope: RequestScope, actor: AuthUser) {
    this.assertDates(dto.startDate, dto.endDate);
    await this.assertColumnFree(scope.sessionId, dto.reportColumn);
    await this.assertColumnFree(scope.sessionId, dto.reportColumnEn, undefined, 'reportColumnEn');
    const e = await this.exams.create({ ...dto, sessionId: scope.sessionId });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'exam', entityId: e.id });
    return e;
  }

  async update(id: number, dto: UpdateExamDto, scope: RequestScope, actor: AuthUser) {
    const e = await this.get(id, scope);
    this.assertDates(dto.startDate ?? e.startDate, dto.endDate ?? e.endDate);
    if (dto.reportColumn !== undefined) await this.assertColumnFree(scope.sessionId, dto.reportColumn, id);
    if (dto.reportColumnEn !== undefined) await this.assertColumnFree(scope.sessionId, dto.reportColumnEn, id, 'reportColumnEn');
    await e.update(dto);
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'exam', entityId: id, meta: { ...dto } });
    return e;
  }

  async remove(id: number, scope: RequestScope, actor: AuthUser) {
    const e = await this.get(id, scope);
    const entered = await this.marks.count({ include: [{ model: ExamSchedule, where: { examId: id }, required: true }] });
    if (entered) throw new BadRequestException(`Marks already entered for ${entered} records — delete those first`);
    await e.destroy();
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'delete', entity: 'exam', entityId: id });
    return { id };
  }

  // ---------- schedule ----------
  async getSchedule(examId: number, classId: number, scope: RequestScope) {
    await this.get(examId, scope);
    return this.schedules.findAll({
      where: { examId, classId },
      include: [{ model: Subject, attributes: ['id', 'name'] }],
      order: [['examDate', 'ASC'], ['startTime', 'ASC']],
    });
  }

  /** Upsert subjects for a class; removing a subject is blocked once marks exist */
  async saveSchedule(examId: number, dto: SaveScheduleDto, scope: RequestScope, actor: AuthUser) {
    await this.get(examId, scope);
    for (const i of dto.items) if (i.passMarks > i.maxMarks + (i.practicalMax ?? 0)) throw new BadRequestException('Pass marks cannot exceed max marks');
    const subjectIds = dto.items.map((i) => i.subjectId);
    if (new Set(subjectIds).size !== subjectIds.length) throw new BadRequestException('A subject is listed twice');

    await this.sequelize.transaction(async (t) => {
      const existing = await this.schedules.findAll({ where: { examId, classId: dto.classId }, transaction: t });
      const removed = existing.filter((s) => !subjectIds.includes(s.subjectId));
      if (removed.length) {
        const withMarks = await this.marks.count({ where: { scheduleId: removed.map((r) => r.id) }, transaction: t });
        if (withMarks) throw new BadRequestException('Cannot remove a subject that already has marks');
        await this.schedules.destroy({ where: { id: removed.map((r) => r.id) }, transaction: t });
      }
      await this.schedules.bulkCreate(
        dto.items.map((i) => ({
          examId,
          classId: dto.classId,
          subjectId: i.subjectId,
          examDate: i.examDate ?? null,
          startTime: i.startTime ?? null,
          endTime: i.endTime ?? null,
          maxMarks: i.maxMarks,
          practicalMax: i.practicalMax ?? null,
          passMarks: i.passMarks,
        })),
        { updateOnDuplicate: ['examDate', 'startTime', 'endTime', 'maxMarks', 'practicalMax', 'passMarks', 'updatedAt'], transaction: t },
      );
    });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'exam_schedule', entityId: examId, meta: { classId: dto.classId } });
    return this.getSchedule(examId, dto.classId, scope);
  }

  // ---------- marks ----------
  async getMarks(q: MarksQueryDto, scope: RequestScope) {
    const sch = await this.schedules.findByPk(q.scheduleId, {
      include: [{ model: Exam, where: { sessionId: scope.sessionId }, required: true }, { model: Subject, attributes: ['id', 'name'] }, { model: SchoolClass, attributes: ['id', 'name'] }],
    });
    if (!sch) throw new NotFoundException('This exam subject was not found in the selected session');
    const enrs = await this.classEnrollments(scope, sch.classId, q.sectionId, q.mediumId);
    const existing = await this.marks.findAll({ where: { scheduleId: sch.id, enrollmentId: enrs.map((e) => e.id) } });
    const by = new Map(existing.map((m) => [m.enrollmentId, m]));
    return {
      schedule: sch,
      rows: enrs.map((e) => {
        const m = by.get(e.id);
        return {
          enrollmentId: e.id,
          rollNo: e.rollNo,
          student: e.student,
          section: e.section,
          marks: m?.marks != null ? toMoney(m.marks) : null,
          practicalMarks: m?.practicalMarks != null ? toMoney(m.practicalMarks) : null,
          isAbsent: m?.isAbsent ?? false,
          remarks: m?.remarks ?? null,
        };
      }),
    };
  }

  async saveMarks(dto: SaveMarksDto, scope: RequestScope, actor: AuthUser) {
    const sch = await this.schedules.findByPk(dto.scheduleId, { include: [{ model: Exam, where: { sessionId: scope.sessionId }, required: true }] });
    if (!sch) throw new NotFoundException('This exam subject was not found in the selected session');
    const max = toMoney(sch.maxMarks);
    const pMax = sch.practicalMax != null ? toMoney(sch.practicalMax) : null;
    for (const r of dto.records) {
      if (!r.isAbsent && r.marks != null && r.marks > max) throw new BadRequestException(`Marks cannot exceed ${max}`);
      if (!r.isAbsent && r.practicalMarks != null && (pMax == null || r.practicalMarks > pMax)) throw new BadRequestException(pMax == null ? 'This subject has no practical' : `Practical marks cannot exceed ${pMax}`);
    }
    const ids = [...new Set(dto.records.map((r) => r.enrollmentId))];
    const ok = await this.enrollments.count({ where: { id: ids, sessionId: scope.sessionId, classId: sch.classId } });
    if (ok !== ids.length) throw new BadRequestException('Some students do not belong to this class/session');

    await this.marks.bulkCreate(
      dto.records.map((r) => ({
        scheduleId: sch.id,
        enrollmentId: r.enrollmentId,
        marks: r.isAbsent ? null : (r.marks ?? null),
        practicalMarks: r.isAbsent || pMax == null ? null : (r.practicalMarks ?? null),
        isAbsent: !!r.isAbsent,
        remarks: r.remarks ?? null,
        enteredBy: actor.id,
      })),
      { updateOnDuplicate: ['marks', 'practicalMarks', 'isAbsent', 'remarks', 'enteredBy', 'updatedAt'] },
    );
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'marks', entity: 'exam_schedule', entityId: sch.id, meta: { count: dto.records.length } });
    return { saved: dto.records.length };
  }

  // ---------- results ----------
  /** Class result for one exam: totals, %, grade, rank (ties share a rank) */
  async classResult(examId: number, q: ClassQueryDto, scope: RequestScope) {
    const exam = await this.get(examId, scope);
    const [schs, enrs, bands] = await Promise.all([
      this.schedules.findAll({ where: { examId, classId: q.classId }, include: [{ model: Subject, attributes: ['id', 'name'] }], order: [['examDate', 'ASC']] }),
      this.classEnrollments(scope, q.classId, q.sectionId, q.mediumId),
      this.settings.get('grades'),
    ]);
    const marks = schs.length && enrs.length ? await this.marks.findAll({ where: { scheduleId: schs.map((s) => s.id), enrollmentId: enrs.map((e) => e.id) } }) : [];
    const by = new Map(marks.map((m) => [`${m.enrollmentId}:${m.scheduleId}`, m]));
    const maxTotal = toMoney(schs.reduce((n, s) => n + fullMax(s), 0));

    const rows = enrs.map((e) => {
      let total = 0;
      let failed = false;
      let entered = 0;
      const subjects = schs.map((s) => {
        const m = by.get(`${e.id}:${s.id}`);
        const val = markValue(m);
        if (m) entered++;
        if (val != null) total += val;
        if (m && (m.isAbsent || (val ?? 0) < toMoney(s.passMarks))) failed = true;
        return { scheduleId: s.id, marks: val, absent: !!m?.isAbsent };
      });
      const percent = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
      const complete = entered === schs.length && schs.length > 0;
      return {
        enrollmentId: e.id,
        rollNo: e.rollNo,
        student: e.student,
        subjects,
        total: toMoney(total),
        percent,
        grade: complete ? gradeFor(percent, bands) : '-',
        result: !complete ? 'Pending' : failed ? 'Fail' : 'Pass',
        rank: null as number | null,
      };
    });
    const ranked = rows.filter((r) => r.result !== 'Pending').sort((a, b) => b.total - a.total);
    ranked.forEach((r, i) => (r.rank = i > 0 && ranked[i - 1].total === r.total ? ranked[i - 1].rank : i + 1));
    return { exam, subjects: schs.map((s) => ({ scheduleId: s.id, subject: s.subject?.name, maxMarks: fullMax(s), passMarks: toMoney(s.passMarks) })), maxTotal, rows };
  }

  /** All report-card exams for one student, subject-wise */
  async reportCard(enrollmentId: number, sessionId: number, opts: { publishedOnly?: boolean } = {}) {
    const enr = await this.enrollments.findOne({
      where: { id: enrollmentId, sessionId },
      include: [
        { model: Student, attributes: ['id', 'name', 'admissionNo', 'fatherName', 'motherName', 'dob'] },
        { model: SchoolClass, attributes: ['id', 'name'] },
        { model: Section, attributes: ['id', 'name'] },
        { model: Medium, attributes: ['id', 'name'] },
      ],
    });
    if (!enr) throw new NotFoundException('Student is not enrolled in this session');

    const examWhere: WhereOptions = { sessionId, includeInReport: true };
    if (opts.publishedOnly) Object.assign(examWhere, { isPublished: true });
    const [exams, bands] = await Promise.all([
      this.exams.findAll({
        where: examWhere,
        include: [{ model: ExamSchedule, where: { classId: enr.classId }, required: true, include: [{ model: Subject, attributes: ['id', 'name'] }] }],
        order: [['startDate', 'ASC'], ['id', 'ASC']],
      }),
      this.settings.get('grades'),
    ]);
    const scheduleIds = exams.flatMap((e) => (e.schedules ?? []).map((s) => s.id));
    const marks = scheduleIds.length ? await this.marks.findAll({ where: { enrollmentId, scheduleId: scheduleIds } }) : [];
    const by = new Map(marks.map((m) => [m.scheduleId, m]));

    const subjectNames = new Map<number, string>();
    for (const e of exams) for (const s of e.schedules ?? []) subjectNames.set(s.subjectId, s.subject?.name ?? '');
    const subjects = [...subjectNames.entries()].sort((a, b) => a[1].localeCompare(b[1]));

    let grandTotal = 0;
    let grandMax = 0;
    const examCols = exams.map((e) => {
      let total = 0;
      let max = 0;
      const cells: Record<number, { marks: number | null; max: number; absent: boolean }> = {};
      for (const s of e.schedules ?? []) {
        const m = by.get(s.id);
        const val = markValue(m);
        cells[s.subjectId] = { marks: val, max: fullMax(s), absent: !!m?.isAbsent };
        if (m) {
          total += val ?? 0;
          max += fullMax(s);
        }
      }
      grandTotal += total;
      grandMax += max;
      return { id: e.id, name: e.name, type: e.type, cells, total: toMoney(total), max: toMoney(max), percent: max ? Math.round((total / max) * 1000) / 10 : null };
    });
    const percent = grandMax ? Math.round((grandTotal / grandMax) * 1000) / 10 : null;
    return {
      enrollment: enr,
      subjects: subjects.map(([id, name]) => ({ id, name })),
      exams: examCols,
      overall: { total: toMoney(grandTotal), max: toMoney(grandMax), percent, grade: percent != null ? gradeFor(percent, bands) : '-' },
    };
  }

  /** Parent portal: admit card download is allowed only after the school releases it */
  async isAdmitCardReleased(examId: number, sessionId: number) {
    return !!(await this.exams.count({ where: { id: examId, sessionId, admitCardVisible: true } }));
  }

  // ---------- PDFs (old school formats, see ExamPrintService) ----------
  /** Admit cards for a class, or for a single enrollment (parent portal) */
  admitCardsPdf(examId: number, q: { classId?: number; sectionId?: number; mediumId?: number }, scope: RequestScope, onlyEnrollmentId?: number) {
    return this.print.admitCardsPdf(examId, q, scope, onlyEnrollmentId);
  }

  reportCardPdf(enrollmentIds: number[], sessionId: number, opts: { publishedOnly?: boolean } = {}) {
    return this.print.marksheetPdf(enrollmentIds, sessionId, opts);
  }

  /** Report card PDFs for a whole class */
  async classReportCardsPdf(q: ClassQueryDto, scope: RequestScope) {
    const enrs = await this.classEnrollments(scope, q.classId, q.sectionId, q.mediumId);
    if (!enrs.length) throw new BadRequestException('No students found');
    return this.reportCardPdf(enrs.map((e) => e.id), scope.sessionId);
  }

  /** Exams (with this class's timetable) for the parent portal */
  examsForClass(sessionId: number, classId: number) {
    return this.exams.findAll({
      where: { sessionId },
      include: [{ model: ExamSchedule, where: { classId }, required: true, include: [{ model: Subject, attributes: ['id', 'name'] }] }],
      order: [['startDate', 'ASC'], [{ model: ExamSchedule, as: 'schedules' }, 'examDate', 'ASC']],
    });
  }

  // ---------- helpers ----------
  private async classEnrollments(scope: RequestScope, classId: number, sectionId?: number, mediumId?: number) {
    const where: WhereOptions = { sessionId: scope.sessionId, classId, status: { [Op.ne]: 'left' } };
    const m = mediumId ?? scope.mediumId;
    if (m) Object.assign(where, { mediumId: m });
    if (sectionId) Object.assign(where, { sectionId });
    return this.enrollments.findAll({
      where,
      include: [
        { model: Student, attributes: ['id', 'name', 'admissionNo', 'fatherName'], required: true },
        { model: SchoolClass, attributes: ['id', 'name'] },
        { model: Section, attributes: ['id', 'name'] },
        { model: Medium, attributes: ['id', 'name'] },
      ],
      order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
    });
  }

  private async get(id: number, scope: RequestScope) {
    const e = await this.exams.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!e) throw new NotFoundException('Exam not found in this session');
    return e;
  }

  private assertDates(start?: string | null, end?: string | null) {
    if (start && end && start > end) throw new BadRequestException('End date must be after start date');
  }
}
