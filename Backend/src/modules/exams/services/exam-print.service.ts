import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { join } from 'path';
import { fn, col, Op, WhereOptions } from 'sequelize';
import { HtmlPdfService } from '../../../common/pdf/html-pdf.service';
import { admitCardsHtml, dateToWords, dayName, dmy, hh12, MarkCell, MarksheetExtras, MarksheetLayout, marksheetHtml, MarksheetSubject } from '../../../common/pdf/print-templates';
import { RequestScope } from '../../../common/interfaces/request-context';
import { toMoney } from '../../../common/utils/money';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Subject } from '../../academic/entities/subject.entity';
import { GradeBand, SettingsService } from '../../admin/services/settings.service';
import { Attendance } from '../../attendance/entities/attendance.entities';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { Exam, ExamMark, ExamSchedule } from '../entities/exam.entities';
import { ReportCardExtra } from '../entities/report-card-extra.entity';

const COLUMNS: Record<MarksheetLayout, string[]> = {
  primary: ['T1', 'T2', 'T3', 'HY', 'AN'],
  secondary: ['T1', 'T2', 'T3', 'HY', 'AN'],
  senior: ['T1', 'T2', 'T3', 'HY', 'AN'],
  english: ['FA1', 'FA2', 'SA1', 'FA3', 'FA4', 'SA2'],
};
/** Max marks printed in the header when an exam is not set up yet (old marksheet values) */
const DEFAULT_MAX: Record<string, number> = { T1: 10, T2: 10, T3: 10, HY: 70, AN: 100, FA1: 20, FA2: 20, SA1: 60, FA3: 20, FA4: 20, SA2: 60 };
const DEFAULT_NOTES = ['Admit card and necessary material have to be brought along.', 'Everyone has to come in complete uniform.'];

const gradeFor = (pct: number, bands: GradeBand[]) => bands.find((b) => pct >= b.min)?.grade ?? '-';
/** Same thresholds as the old marksheet */
const divisionFor = (pct: number | null) => (pct == null ? '' : pct >= 60 ? 'First Division' : pct >= 50 ? 'Second Division' : pct >= 40 ? 'Third Division' : 'Fail');
/** "9" + "A" → "9A"; "11 Science" + "A" → "11 Science A" */
const classLabel = (e: StudentEnrollment) => {
  const c = e.schoolClass?.name ?? '';
  const s = e.section?.name ?? '';
  return !s ? c : /^\d+$/.test(c) ? `${c}${s}` : `${c} ${s}`;
};
const mostCommon = (xs: number[]) => {
  const m = new Map<number, number>();
  xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
};

/** Old-format admit cards and marksheets (HTML → PDF) */
@Injectable()
export class ExamPrintService {
  constructor(
    @InjectModel(Exam) private readonly exams: typeof Exam,
    @InjectModel(ExamSchedule) private readonly schedules: typeof ExamSchedule,
    @InjectModel(ExamMark) private readonly marks: typeof ExamMark,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(ReportCardExtra) private readonly extras: typeof ReportCardExtra,
    @InjectModel(Attendance) private readonly attendance: typeof Attendance,
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    private readonly settings: SettingsService,
    private readonly pdf: HtmlPdfService,
  ) {}

  private logo(logoPath: string | null) {
    return (logoPath && this.pdf.upload(logoPath, true)) || this.pdf.dataUri(join(process.cwd(), 'assets', 'default-logo.jpg'), true);
  }

  static layoutFor(e: StudentEnrollment): MarksheetLayout {
    if (e.medium?.code === 'en') return 'english';
    const g = e.schoolClass?.classGroup;
    if (g === 'highsecondary') return 'senior';
    if (g === 'secondary' || g === 'upperprimary') return 'secondary';
    return 'primary';
  }

  private loadEnrollments(where: WhereOptions) {
    return this.enrollments.findAll({
      where,
      include: [
        { model: Student, required: true },
        { model: SchoolClass, attributes: ['id', 'name', 'classGroup'] },
        { model: Section, attributes: ['id', 'name'] },
        { model: Medium, attributes: ['id', 'name', 'code'] },
      ],
      order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
    });
  }

  // ---------------------------------------------------------------- admit cards
  async admitCardsPdf(examId: number, q: { classId: number; sectionId?: number; mediumId?: number }, scope: RequestScope, onlyEnrollmentId?: number) {
    const exam = await this.exams.findOne({ where: { id: examId, sessionId: scope.sessionId } });
    if (!exam) throw new NotFoundException('Exam not found in this session');
    const where: WhereOptions = { sessionId: scope.sessionId, classId: q.classId, status: { [Op.ne]: 'left' } };
    const medium = q.mediumId ?? scope.mediumId;
    if (medium) Object.assign(where, { mediumId: medium });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });
    if (onlyEnrollmentId) Object.assign(where, { id: onlyEnrollmentId });

    const [schs, enrs, print, school, session] = await Promise.all([
      this.schedules.findAll({ where: { examId, classId: q.classId }, include: [{ model: Subject, attributes: ['name'] }], order: [['examDate', 'ASC'], ['startTime', 'ASC']] }),
      this.loadEnrollments(where),
      this.settings.get('print'),
      this.settings.get('school'),
      this.sessions.findByPk(scope.sessionId),
    ]);
    if (!schs.length) throw new BadRequestException('Add the exam timetable for this class first');
    if (!enrs.length) throw new BadRequestException('No students found');

    const notes = (exam.instructions ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    const html = admitCardsHtml({
      logo: this.logo(school.logoPath),
      title: print.admitName,
      examLine: `ADMIT CARD - ${exam.name.toUpperCase()}${/\bEXAM\b/i.test(exam.name) ? '' : ' EXAM'} ${session?.name ?? ''}`,
      schedule: schs.map((s) => ({ date: s.examDate ?? '', day: dayName(s.examDate), from: hh12(s.startTime), to: hh12(s.endTime), subject: (s.subject?.name ?? '').toUpperCase() })),
      notes: notes.length ? notes : DEFAULT_NOTES,
      students: enrs.map((e) => ({
        campusLine: `${e.medium?.code === 'en' ? print.campusEn : print.campusHi} ${print.phone}`,
        name: e.student?.name ?? '',
        dob: dmy(e.student?.dob),
        category: e.student?.category ?? '',
        rollNo: e.rollNo != null ? String(e.rollNo) : (e.student?.admissionNo ?? ''),
        father: e.student?.fatherName ?? '',
        mother: e.student?.motherName ?? '',
        village: e.student?.address ?? '',
        mobile: e.student?.fatherMobile ?? e.student?.motherMobile ?? '',
        className: classLabel(e),
        photo: this.pdf.upload(e.student?.photoPath),
      })),
    });
    return this.pdf.render(html);
  }

  // ---------------------------------------------------------------- marksheets
  async marksheetPdf(enrollmentIds: number[], sessionId: number, opts: { publishedOnly?: boolean } = {}) {
    const targets = await this.loadEnrollments({ id: enrollmentIds, sessionId });
    if (!targets.length) throw new NotFoundException('Student is not enrolled in this session');
    const [print, school, bands, session] = await Promise.all([this.settings.get('print'), this.settings.get('school'), this.settings.get('grades'), this.sessions.findByPk(sessionId)]);
    const logo = this.logo(school.logoPath);

    // Group by class + medium: columns, ranks and exam lists are per group
    const groups = new Map<string, StudentEnrollment[]>();
    for (const e of targets) {
      const k = `${e.classId}:${e.mediumId}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }

    const pages: string[] = [];
    for (const list of groups.values()) {
      const first = list[0];
      const layout = ExamPrintService.layoutFor(first);
      const cols = COLUMNS[layout];
      const field = layout === 'english' ? 'reportColumnEn' : 'reportColumn';
      const examWhere: WhereOptions = { sessionId, [field]: cols };
      if (opts.publishedOnly) Object.assign(examWhere, { isPublished: true });
      const exams = await this.exams.findAll({
        where: examWhere,
        include: [{ model: ExamSchedule, where: { classId: first.classId }, required: true, include: [{ model: Subject, attributes: ['id', 'name', 'isAdditional'] }] }],
        order: [['startDate', 'ASC'], ['id', 'ASC']],
      });
      // One exam per column (latest wins if two are mapped to the same column)
      const byCol = new Map<string, Exam>();
      for (const ex of exams) byCol.set(ex[field]!, ex);

      // Everyone in the class+medium, for rank
      const classmates = await this.enrollments.findAll({
        where: { sessionId, classId: first.classId, mediumId: first.mediumId, status: { [Op.ne]: 'left' } },
        attributes: ['id'],
      });
      const allIds = classmates.map((c) => c.id);
      const schedules = [...byCol.values()].flatMap((ex) => ex.schedules ?? []);
      const marks = schedules.length ? await this.marks.findAll({ where: { scheduleId: schedules.map((s) => s.id), enrollmentId: allIds } }) : [];
      const markBy = new Map(marks.map((m) => [`${m.enrollmentId}:${m.scheduleId}`, m]));

      // Subjects: union over the mapped exams, ordered by id (Hindi, English, …)
      const subjMap = new Map<number, { name: string; additional: boolean }>();
      for (const s of schedules) subjMap.set(s.subjectId, { name: s.subject?.name ?? '', additional: !!s.subject?.isAdditional });
      const subjectIds = [...subjMap.keys()].sort((a, b) => a - b);

      const colMax: Record<string, number> = Object.fromEntries(cols.map((c) => [c, DEFAULT_MAX[c]]));
      const colSplit: Record<string, { th: number; pr: number | null }> = {};
      for (const [code, ex] of byCol) {
        const mainSch = (ex.schedules ?? []).filter((s) => !s.subject?.isAdditional);
        const use = mainSch.length ? mainSch : (ex.schedules ?? []);
        colMax[code] = mostCommon(use.map((s) => toMoney(s.maxMarks) + (s.practicalMax != null ? toMoney(s.practicalMax) : 0)));
        colSplit[code] = { th: mostCommon(use.map((s) => toMoney(s.maxMarks))), pr: use.some((s) => s.practicalMax != null) ? mostCommon(use.filter((s) => s.practicalMax != null).map((s) => toMoney(s.practicalMax!))) : null };
      }

      const buildSubjects = (enrollmentId: number): MarksheetSubject[] =>
        subjectIds.map((sid) => {
          const cells: Partial<Record<string, MarkCell>> = {};
          for (const [code, ex] of byCol) {
            const sch = (ex.schedules ?? []).find((s) => s.subjectId === sid);
            if (!sch) continue;
            const m = markBy.get(`${enrollmentId}:${sch.id}`);
            const thMax = toMoney(sch.maxMarks);
            const prMax = sch.practicalMax != null ? toMoney(sch.practicalMax) : null;
            const th = m && !m.isAbsent && m.marks != null ? toMoney(m.marks) : null;
            const pr = m && !m.isAbsent && m.practicalMarks != null ? toMoney(m.practicalMarks) : null;
            const total = th == null && pr == null ? null : toMoney((th ?? 0) + (pr ?? 0));
            // Max counts only once marks are entered (or absent), so % reflects exams held so far
            const counted = total != null || !!m?.isAbsent;
            cells[code] = { th, pr, total, max: counted ? toMoney(thMax + (prMax ?? 0)) : 0, thMax, prMax, absent: !!m?.isAbsent };
          }
          return { name: subjMap.get(sid)!.name, additional: subjMap.get(sid)!.additional, cells };
        });

      // Overall % = main subjects, all mapped columns (matches the grand total on every layout)
      const overallOf = (subs: MarksheetSubject[]) => {
        let got = 0;
        let max = 0;
        let any = false;
        for (const s of subs.filter((x) => !x.additional))
          for (const c of Object.values(s.cells)) {
            if (!c) continue;
            max += c.max;
            if (c.total != null) {
              got += c.total;
              any = true;
            }
          }
        return any && max ? Math.round((got / max) * 10000) / 100 : null;
      };
      const pctById = new Map(allIds.map((id) => [id, overallOf(buildSubjects(id))]));
      const ranked = [...pctById.entries()].filter(([, p]) => p != null && p >= 40).sort((a, b) => b[1]! - a[1]!);
      const rankOf = new Map<number, number>();
      ranked.forEach(([id, p], i) => rankOf.set(id, i > 0 && ranked[i - 1][1] === p ? rankOf.get(ranked[i - 1][0])! : i + 1));

      const [extraRows, attRows] = await Promise.all([
        this.extras.findAll({ where: { enrollmentId: list.map((e) => e.id) } }),
        this.attendance.findAll({
          where: { sessionId, enrollmentId: list.map((e) => e.id) },
          attributes: ['enrollmentId', 'status', [fn('COUNT', col('id')), 'n']],
          group: ['enrollmentId', 'status'],
          raw: true,
        }) as unknown as Promise<{ enrollmentId: number; status: string; n: number }[]>,
      ]);
      const extraBy = new Map(extraRows.map((x) => [x.enrollmentId, x.data ?? {}]));
      const declExam = byCol.get(layout === 'english' ? 'SA2' : 'AN') ?? [...byCol.values()].reverse().find((x) => x.resultDate);

      for (const e of list) {
        const extras: MarksheetExtras = extraBy.get(e.id) ?? {};
        const att = attRows.filter((r) => r.enrollmentId === e.id);
        const count = (s: string) => Number(att.find((r) => r.status === s)?.n ?? 0);
        const meetings = att.reduce((n, r) => n + Number(r.n), 0);
        const percent = pctById.get(e.id) ?? null;
        const division = divisionFor(percent);
        pages.push(
          marksheetHtml({
            layout,
            logo,
            photo: this.pdf.upload(e.student?.photoPath),
            print,
            campus: e.medium?.code === 'en' ? print.campusEn : print.campusHi,
            session: session?.name ?? '',
            student: {
              name: e.student?.name ?? '',
              father: e.student?.fatherName ?? '',
              mother: e.student?.motherName ?? '',
              dob: dmy(e.student?.dob),
              dobWords: dateToWords(e.student?.dob),
              className: classLabel(e),
              rollNo: e.rollNo != null ? String(e.rollNo) : '',
              srNo: e.student?.admissionNo ?? '',
            },
            colMax,
            colSplit,
            subjects: buildSubjects(e.id),
            overall: { percent, division: percent == null ? '' : division, result: percent == null ? '' : division === 'Fail' ? 'Fail' : 'Pass', rank: rankOf.get(e.id) ?? null },
            declarationDate: dmy(declExam?.resultDate),
            meetings: extras.totalMeetings ?? (meetings || null),
            attended: extras.attendance ?? (meetings ? count('P') + count('HD') * 0.5 : null),
            extras,
            grade: (p) => gradeFor(p, bands),
          }),
        );
      }
    }
    // Each marksheet is its own document; join the bodies with page breaks
    return this.pdf.render(joinPages(pages), { margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
  }

  // ---------------------------------------------------------------- extras
  async getExtras(enrollmentId: number, sessionId: number) {
    const enr = await this.enrollments.findOne({ where: { id: enrollmentId, sessionId }, include: [{ model: SchoolClass, attributes: ['classGroup'] }, { model: Medium, attributes: ['code'] }] });
    if (!enr) throw new NotFoundException('Student is not enrolled in this session');
    const row = await this.extras.findOne({ where: { enrollmentId } });
    return { layout: ExamPrintService.layoutFor(enr), data: row?.data ?? {} };
  }

  async saveExtras(enrollmentId: number, sessionId: number, data: MarksheetExtras, userId: number) {
    const enr = await this.enrollments.findOne({ where: { id: enrollmentId, sessionId }, attributes: ['id'] });
    if (!enr) throw new NotFoundException('Student is not enrolled in this session');
    await this.extras.upsert({ enrollmentId, sessionId, data, updatedBy: userId });
    return this.getExtras(enrollmentId, sessionId);
  }
}

/** Merges several full HTML documents into one, separated by page breaks */
function joinPages(docs: string[]) {
  if (docs.length === 1) return docs[0];
  const head = docs[0].slice(0, docs[0].indexOf('<body>') + 6);
  const bodies = docs.map((d) => d.slice(d.indexOf('<body>') + 6, d.lastIndexOf('</body>')));
  return `${head}${bodies.map((b) => `<div class="brk">${b}</div>`).join('')}</body></html>`;
}
