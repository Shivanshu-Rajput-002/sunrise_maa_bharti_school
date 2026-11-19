import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import ExcelJS from 'exceljs';
import { Op, WhereOptions } from 'sequelize';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { toMoney } from '../../../common/utils/money';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Subject } from '../../academic/entities/subject.entity';
import { AuditService } from '../../admin/services/audit.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { Exam, ExamMark, ExamSchedule } from '../entities/exam.entities';

/** One Excel column = one subject part (theory or practical) */
interface Col {
  scheduleId: number;
  part: 'th' | 'pr';
  max: number;
  header: string;
}

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim();
  return String(v).trim();
};

/**
 * Marks entry through Excel: download a sheet pre-filled with the class's students and one
 * column per subject (theory / practical), fill it, upload it back. Blank cells leave
 * existing marks untouched; "AB" marks the student absent for that subject.
 */
@Injectable()
export class MarksExcelService {
  constructor(
    @InjectModel(Exam) private readonly exams: typeof Exam,
    @InjectModel(ExamSchedule) private readonly schedules: typeof ExamSchedule,
    @InjectModel(ExamMark) private readonly marks: typeof ExamMark,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    private readonly audit: AuditService,
  ) {}

  private async setup(examId: number, q: { classId: number; sectionId?: number; mediumId?: number }, scope: RequestScope) {
    const exam = await this.exams.findOne({ where: { id: examId, sessionId: scope.sessionId } });
    if (!exam) throw new NotFoundException('Exam not found in this session');
    const schs = await this.schedules.findAll({
      where: { examId, classId: q.classId },
      include: [{ model: Subject, attributes: ['id', 'name'] }, { model: SchoolClass, attributes: ['name'] }],
      order: [['examDate', 'ASC'], ['startTime', 'ASC'], ['id', 'ASC']],
    });
    if (!schs.length) throw new BadRequestException('This class has no timetable for the exam yet (Exams → Timetable).');
    const cols: Col[] = [];
    for (const s of schs) {
      const name = s.subject?.name ?? 'Subject';
      if (s.practicalMax != null) {
        cols.push({ scheduleId: s.id, part: 'th', max: toMoney(s.maxMarks), header: `${name} TH (/${toMoney(s.maxMarks)})` });
        cols.push({ scheduleId: s.id, part: 'pr', max: toMoney(s.practicalMax), header: `${name} PR (/${toMoney(s.practicalMax)})` });
      } else cols.push({ scheduleId: s.id, part: 'th', max: toMoney(s.maxMarks), header: `${name} (/${toMoney(s.maxMarks)})` });
    }
    const where: WhereOptions = { sessionId: scope.sessionId, classId: q.classId, status: { [Op.ne]: 'left' } };
    const m = q.mediumId ?? scope.mediumId;
    if (m) Object.assign(where, { mediumId: m });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });
    const enrs = await this.enrollments.findAll({
      where,
      attributes: ['id', 'rollNo'],
      include: [{ model: Student, attributes: ['name', 'admissionNo'], required: true }, { model: Section, attributes: ['name'] }],
      order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
    });
    return { exam, schs, cols, enrs, className: schs[0].schoolClass?.name ?? '' };
  }

  async template(examId: number, q: { classId: number; sectionId?: number; mediumId?: number }, scope: RequestScope) {
    const { exam, schs, cols, enrs, className } = await this.setup(examId, q, scope);
    const existing = enrs.length ? await this.marks.findAll({ where: { scheduleId: schs.map((s) => s.id), enrollmentId: enrs.map((e) => e.id) } }) : [];
    const by = new Map(existing.map((x) => [`${x.enrollmentId}:${x.scheduleId}`, x]));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Marks');
    ws.getCell('A1').value = `${exam.name} — Class ${className}`;
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A2').value = 'Fill marks below. Leave a cell empty to keep the saved marks. Type AB for absent. Do not change the first column.';
    ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    const header = ['Student ID', 'Roll', 'Admission No', 'Student', 'Section', ...cols.map((c) => c.header)];
    const hr = ws.getRow(4);
    header.forEach((h, i) => (hr.getCell(i + 1).value = h));
    hr.font = { bold: true };
    hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    enrs.forEach((e, n) => {
      const row = ws.getRow(5 + n);
      row.values = [
        e.id,
        e.rollNo ?? '',
        e.student?.admissionNo ?? '',
        e.student?.name ?? '',
        e.section?.name ?? '',
        ...cols.map((c) => {
          const mk = by.get(`${e.id}:${c.scheduleId}`);
          if (!mk) return '';
          if (mk.isAbsent) return 'AB';
          const v = c.part === 'th' ? mk.marks : mk.practicalMarks;
          return v == null ? '' : toMoney(v);
        }),
      ];
    });
    ws.getColumn(1).hidden = true; // ID column is for matching only
    [6, 8, 14, 24, 8].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    cols.forEach((c, i) => {
      const col = ws.getColumn(6 + i);
      col.width = Math.max(12, c.header.length + 2);
      // Only numbers 0..max (or AB) are accepted while typing
      for (let r = 5; r < 5 + enrs.length; r++) {
        ws.getCell(r, 6 + i).dataValidation = {
          type: 'custom',
          allowBlank: true,
          formulae: [`OR(UPPER(${ws.getCell(r, 6 + i).address})="AB",AND(ISNUMBER(${ws.getCell(r, 6 + i).address}),${ws.getCell(r, 6 + i).address}>=0,${ws.getCell(r, 6 + i).address}<=${c.max}))`],
          showErrorMessage: true,
          errorTitle: 'Invalid marks',
          error: `Enter 0 to ${c.max}, or AB for absent`,
        };
      }
    });
    ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 4 }];
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `marks-${exam.name}-class-${className}.xlsx`.replace(/[^\w.-]+/g, '-') };
  }

  async import(examId: number, q: { classId: number; sectionId?: number; mediumId?: number }, file: Buffer, scope: RequestScope, actor: AuthUser) {
    const { schs, cols, enrs } = await this.setup(examId, q, scope);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Could not read the file. Please upload the .xlsx template downloaded from this page.');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('The file has no sheet');

    // Find the header row and map columns by header text (order may change)
    let headerRow = 0;
    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) if (cellText(ws.getRow(r).getCell(1).value) === 'Student ID') headerRow = r;
    if (!headerRow) throw new BadRequestException('This is not the marks template. Download the template from this page and fill it.');
    const colIndex = new Map<string, number>();
    ws.getRow(headerRow).eachCell((cell, i) => colIndex.set(cellText(cell.value), i));
    const missing = cols.filter((c) => !colIndex.has(c.header));
    if (missing.length === cols.length) throw new BadRequestException('No subject columns match this class timetable. Download a fresh template.');

    const valid = new Set(enrs.map((e) => e.id));
    const nameOf = new Map(enrs.map((e) => [e.id, e.student?.name ?? '']));
    const existing = await this.marks.findAll({ where: { scheduleId: schs.map((s) => s.id), enrollmentId: [...valid] } });
    const current = new Map(existing.map((x) => [`${x.enrollmentId}:${x.scheduleId}`, x]));

    const out = new Map<string, { scheduleId: number; enrollmentId: number; marks: number | null; practicalMarks: number | null; isAbsent: boolean }>();
    const errors: string[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const id = Number(cellText(row.getCell(1).value));
      if (!id) continue;
      if (!valid.has(id)) {
        errors.push(`Row ${r}: student is not in this class/medium/section — skipped`);
        continue;
      }
      for (const c of cols) {
        const ci = colIndex.get(c.header);
        if (!ci) continue;
        const raw = cellText(row.getCell(ci).value);
        if (raw === '') continue;
        const key = `${id}:${c.scheduleId}`;
        const base = out.get(key) ?? (() => {
          const cur = current.get(key);
          return { scheduleId: c.scheduleId, enrollmentId: id, marks: cur?.marks != null ? toMoney(cur.marks) : null, practicalMarks: cur?.practicalMarks != null ? toMoney(cur.practicalMarks) : null, isAbsent: !!cur?.isAbsent };
        })();
        if (raw.toUpperCase() === 'AB') {
          out.set(key, { ...base, marks: null, practicalMarks: null, isAbsent: true });
          continue;
        }
        const v = Number(raw);
        if (!Number.isFinite(v) || v < 0 || v > c.max) {
          errors.push(`Row ${r} (${nameOf.get(id)}), ${c.header}: "${raw}" is not valid — use 0 to ${c.max} or AB`);
          continue;
        }
        out.set(key, { ...base, isAbsent: false, [c.part === 'th' ? 'marks' : 'practicalMarks']: toMoney(v) });
      }
    }
    const records = [...out.values()];
    if (records.length)
      await this.marks.bulkCreate(
        records.map((x) => ({ ...x, enteredBy: actor.id })),
        { updateOnDuplicate: ['marks', 'practicalMarks', 'isAbsent', 'enteredBy', 'updatedAt'] },
      );
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'marks_import', entity: 'exam', entityId: examId, meta: { classId: q.classId, saved: records.length, errors: errors.length } });
    return {
      saved: records.length,
      students: new Set(records.map((x) => x.enrollmentId)).size,
      skippedColumns: missing.map((c) => c.header),
      errors: errors.slice(0, 50),
      moreErrors: Math.max(0, errors.length - 50),
    };
  }
}
