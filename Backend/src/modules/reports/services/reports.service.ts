import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RequestScope } from '../../../common/interfaces/request-context';
import { buildSheet, MONEY_FMT } from '../../../common/utils/excel';
import { toMoney } from '../../../common/utils/money';
import { fmtDate, letterhead, renderPdf, table } from '../../../common/utils/pdf';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { SettingsService } from '../../admin/services/settings.service';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { FeePayment } from '../../fees/entities/fee.entities';
import { FeeCollectionService } from '../../fees/services/fee-collection.service';
import { FeeLedgerService } from '../../fees/services/fee-ledger.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { ReportQueryDto, ReportType } from '../dto/report.dto';

export interface ReportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(FeePayment) private readonly payments: typeof FeePayment,
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    private readonly attendance: AttendanceService,
    private readonly fees: FeeCollectionService,
    private readonly ledger: FeeLedgerService,
    private readonly settings: SettingsService,
    private readonly sequelize: Sequelize,
  ) {}

  async export(type: ReportType, q: ReportQueryDto, scope: RequestScope): Promise<ReportFile> {
    const session = await this.sessions.findByPk(scope.sessionId);
    const tag = `${session?.name ?? ''}${scope.mediumId ? '' : ''}`;
    switch (type) {
      case 'students':
        return this.xlsx(`students-${tag}`, await this.students(q, scope, session?.name));
      case 'parents':
        return this.xlsx(`parents-${tag}`, await this.parents(q, scope, session?.name));
      case 'attendance':
        return this.xlsx(`attendance-${q.month}`, await this.attendanceRegister(q, scope));
      case 'collection':
        return this.xlsx(`fee-collection-${tag}`, await this.collection(q, scope, session?.name));
      case 'daywise':
        return this.xlsx(`daywise-collection-${tag}`, await this.daywise(q, scope, session?.name));
      case 'dues':
        return this.xlsx(`fee-dues-${tag}`, await this.dues(q, scope, session?.name));
      case 'installments':
        return this.xlsx(`installment-collection-${tag}`, await this.installmentWise(q, scope, session?.name));
      case 'ptm':
        return q.format === 'pdf'
          ? { buffer: await this.ptmPdf(q, scope, session?.name), filename: `ptm-sheet.pdf`, contentType: 'application/pdf' }
          : this.xlsx('ptm-sheet', await this.ptm(q, scope, session?.name));
    }
  }

  // ---------- builders ----------
  private async xlsx(filename: string, buffer: Promise<Buffer> | Buffer): Promise<ReportFile> {
    return { buffer: await buffer, filename: `${filename}.xlsx`, contentType: XLSX };
  }

  private enrollmentWhere(q: ReportQueryDto, scope: RequestScope, studyingOnly = true): WhereOptions {
    const where: WhereOptions = { sessionId: scope.sessionId };
    if (studyingOnly) Object.assign(where, { status: { [Op.ne]: 'left' } });
    if (scope.mediumId) Object.assign(where, { mediumId: scope.mediumId });
    if (q.classId) Object.assign(where, { classId: q.classId });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });
    return where;
  }

  private loadEnrollments(q: ReportQueryDto, scope: RequestScope) {
    return this.enrollments.findAll({
      where: this.enrollmentWhere(q, scope),
      include: [
        { model: Student, required: true },
        { model: SchoolClass, attributes: ['name', 'sortOrder'] },
        { model: Section, attributes: ['name'] },
        { model: Medium, attributes: ['name'] },
      ],
      order: [[{ model: SchoolClass, as: 'schoolClass' }, 'sortOrder', 'ASC'], ['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
    });
  }

  private async students(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const enrs = await this.loadEnrollments(q, scope);
    return buildSheet(
      'Students',
      [
        { header: 'Admission No', key: 'adm', width: 14 },
        { header: 'Name', key: 'name', width: 24 },
        { header: 'Class', key: 'cls', width: 10 },
        { header: 'Roll', key: 'roll', width: 6 },
        { header: 'Medium', key: 'medium', width: 9 },
        { header: 'Gender', key: 'gender', width: 8 },
        { header: 'DOB', key: 'dob', width: 12 },
        { header: 'Category', key: 'cat', width: 9 },
        { header: 'Father', key: 'father', width: 22 },
        { header: 'Mother', key: 'mother', width: 22 },
        { header: 'Father Mobile', key: 'mobile', width: 13 },
        { header: 'Aadhar', key: 'aadhar', width: 14 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Hostel', key: 'hostel', width: 7 },
        { header: 'Transport', key: 'transport', width: 9 },
        { header: 'Status', key: 'status', width: 9 },
      ],
      enrs.map((e) => ({
        adm: e.student!.admissionNo,
        name: e.student!.name,
        cls: `${e.schoolClass?.name ?? ''}${e.section ? '-' + e.section.name : ''}`,
        roll: e.rollNo,
        medium: e.medium?.name,
        gender: e.student!.gender,
        dob: fmtDate(e.student!.dob),
        cat: e.student!.category,
        father: e.student!.fatherName,
        mother: e.student!.motherName,
        mobile: e.student!.fatherMobile,
        aadhar: e.student!.aadharNo,
        address: [e.student!.address, e.student!.city, e.student!.pincode].filter(Boolean).join(', '),
        hostel: e.isHostel ? 'Yes' : 'No',
        transport: e.usesTransport ? 'Yes' : 'No',
        status: e.status,
      })),
      [`Students — Session ${session ?? ''}`, `Total: ${enrs.length}`],
    );
  }

  /** One row per family (father mobile), listing all children */
  private async parents(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const enrs = await this.loadEnrollments(q, scope);
    const families = new Map<string, { father: string; mother: string; mobile: string; whatsapp: string; address: string; children: string[] }>();
    for (const e of enrs) {
      const s = e.student!;
      const k = s.fatherMobile || `no-mobile-${s.id}`;
      const f = families.get(k) ?? { father: s.fatherName ?? '', mother: s.motherName ?? '', mobile: s.fatherMobile ?? '', whatsapp: s.whatsappNo ?? '', address: [s.address, s.city].filter(Boolean).join(', '), children: [] };
      f.children.push(`${s.name} (${e.schoolClass?.name ?? ''}${e.section ? '-' + e.section.name : ''})`);
      families.set(k, f);
    }
    return buildSheet(
      'Parents',
      [
        { header: 'Father', key: 'father', width: 24 },
        { header: 'Mother', key: 'mother', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 13 },
        { header: 'WhatsApp', key: 'whatsapp', width: 13 },
        { header: 'Children', key: 'children', width: 50 },
        { header: 'Address', key: 'address', width: 32 },
      ],
      [...families.values()].map((f) => ({ ...f, children: f.children.join(', ') })),
      [`Parents — Session ${session ?? ''}`, `Families: ${families.size}`],
    );
  }

  private async attendanceRegister(q: ReportQueryDto, scope: RequestScope) {
    if (!q.classId || !q.month) throw new BadRequestException('Class and month are required');
    const reg = await this.attendance.register({ classId: q.classId, sectionId: q.sectionId, month: q.month }, scope);
    const dayCols = Array.from({ length: reg.days }, (_, i) => ({ header: String(i + 1), key: `d${i + 1}`, width: 4 }));
    return buildSheet(
      `Attendance ${q.month}`,
      [
        { header: 'Roll', key: 'roll', width: 6 },
        { header: 'Name', key: 'name', width: 24 },
        ...dayCols,
        { header: 'Present', key: 'present', width: 8 },
        { header: 'Absent', key: 'absent', width: 8 },
        { header: 'Leave', key: 'leave', width: 7 },
        { header: '%', key: 'pct', width: 7 },
      ],
      reg.rows.map((r) => ({
        roll: r.rollNo,
        name: r.student?.name,
        ...Object.fromEntries(Array.from({ length: reg.days }, (_, i) => [`d${i + 1}`, r.days[i + 1] ?? (reg.offDays[i + 1] ? 'H' : '')])),
        present: r.present,
        absent: r.absent,
        leave: r.leave,
        pct: r.percent,
      })),
      [`Attendance register — ${q.month}`, 'P = Present, A = Absent, L = Leave, HD = Half day, H = Holiday/Sunday'],
    );
  }

  private async collection(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const where: WhereOptions = { sessionId: scope.sessionId };
    if (scope.mediumId) Object.assign(where, { mediumId: scope.mediumId });
    if (q.from || q.to) Object.assign(where, { paymentDate: { ...(q.from ? { [Op.gte]: q.from } : {}), ...(q.to ? { [Op.lte]: q.to } : {}) } });
    const rows = await this.payments.findAll({
      where,
      include: [
        { model: Student, attributes: ['name', 'admissionNo'] },
        { model: StudentEnrollment, attributes: ['id'], where: q.classId ? { classId: q.classId } : undefined, include: [{ model: SchoolClass, attributes: ['name'] }, { model: Section, attributes: ['name'] }] },
      ],
      order: [['paymentDate', 'ASC'], ['id', 'ASC']],
    });
    const paid = rows.filter((r) => r.status === 'paid');
    return buildSheet(
      'Collection',
      [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Receipt', key: 'receipt', width: 13 },
        { header: 'Admission No', key: 'adm', width: 14 },
        { header: 'Student', key: 'name', width: 24 },
        { header: 'Class', key: 'cls', width: 10 },
        { header: 'Mode', key: 'mode', width: 8 },
        { header: 'Gross', key: 'gross', width: 11, numFmt: MONEY_FMT },
        { header: 'Discount', key: 'discount', width: 10, numFmt: MONEY_FMT },
        { header: 'Fine', key: 'fine', width: 9, numFmt: MONEY_FMT },
        { header: 'Net', key: 'net', width: 11, numFmt: MONEY_FMT },
        { header: 'Status', key: 'status', width: 10 },
      ],
      rows.map((r) => ({
        date: fmtDate(r.paymentDate),
        receipt: r.receiptNo,
        adm: r.student?.admissionNo,
        name: r.student?.name,
        cls: `${r.enrollment?.schoolClass?.name ?? ''}${r.enrollment?.section ? '-' + r.enrollment.section.name : ''}`,
        mode: r.mode,
        gross: toMoney(r.grossAmount),
        discount: toMoney(r.discount),
        fine: toMoney(r.fine),
        net: toMoney(r.netAmount),
        status: r.status,
      })),
      [
        `Fee collection — Session ${session ?? ''}`,
        `Period: ${q.from ? fmtDate(q.from) : 'start'} to ${q.to ? fmtDate(q.to) : 'today'} · Receipts: ${paid.length} · Total: ${toMoney(paid.reduce((n, r) => n + toMoney(r.netAmount), 0))}`,
      ],
    );
  }

  private async daywise(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const where: WhereOptions = { sessionId: scope.sessionId, status: 'paid' };
    if (scope.mediumId) Object.assign(where, { mediumId: scope.mediumId });
    if (q.from || q.to) Object.assign(where, { paymentDate: { ...(q.from ? { [Op.gte]: q.from } : {}), ...(q.to ? { [Op.lte]: q.to } : {}) } });
    const rows = (await this.payments.findAll({
      where,
      attributes: ['paymentDate', 'mode', [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count'], [this.sequelize.fn('SUM', this.sequelize.col('net_amount')), 'total']],
      group: ['paymentDate', 'mode'],
      order: [['paymentDate', 'ASC']],
      raw: true,
    })) as unknown as { paymentDate: string; mode: string; count: number; total: string }[];
    const modes = ['cash', 'upi', 'online', 'cheque', 'bank'];
    const byDate = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const d = byDate.get(r.paymentDate) ?? { receipts: 0, total: 0 };
      d[r.mode] = toMoney((d[r.mode] ?? 0) + toMoney(r.total));
      d.receipts += Number(r.count);
      d.total = toMoney(d.total + toMoney(r.total));
      byDate.set(r.paymentDate, d);
    }
    const data: Record<string, unknown>[] = [...byDate.entries()].map(([date, d]) => ({ date: fmtDate(date), ...d }));
    const grand = [...byDate.values()].reduce((n, d) => n + d.total, 0);
    return buildSheet(
      'Day-wise',
      [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Receipts', key: 'receipts', width: 9 },
        ...modes.map((m) => ({ header: m.toUpperCase(), key: m, width: 11, numFmt: MONEY_FMT })),
        { header: 'Total', key: 'total', width: 12, numFmt: MONEY_FMT },
      ],
      data,
      [`Day-wise collection — Session ${session ?? ''}`, `Grand total: ${toMoney(grand)}`],
    );
  }

  private async dues(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const res = await this.fees.dues({ classId: q.classId, sectionId: q.sectionId, page: 1, limit: 100000, onlyDue: false }, scope);
    return buildSheet(
      'Dues',
      [
        { header: 'Admission No', key: 'adm', width: 14 },
        { header: 'Student', key: 'name', width: 24 },
        { header: 'Class', key: 'cls', width: 10 },
        { header: 'Father', key: 'father', width: 22 },
        { header: 'Mobile', key: 'mobile', width: 13 },
        { header: 'Payable', key: 'payable', width: 11, numFmt: MONEY_FMT },
        { header: 'Paid', key: 'paid', width: 11, numFmt: MONEY_FMT },
        { header: 'Due (till today)', key: 'dueNow', width: 14, numFmt: MONEY_FMT },
        { header: 'Due (full year)', key: 'due', width: 14, numFmt: MONEY_FMT },
      ],
      res.items.map((r) => ({
        adm: r.student?.admissionNo,
        name: r.student?.name,
        cls: `${r.schoolClass?.name ?? ''}${r.section ? '-' + r.section.name : ''}`,
        father: r.student?.fatherName,
        mobile: r.student?.fatherMobile,
        payable: r.totals.payable,
        paid: r.totals.paid,
        dueNow: r.totals.dueTillDate,
        due: r.totals.due,
      })),
      [`Fee dues — Session ${session ?? ''}`, `Defaulters: ${res.summary.defaulters} · Due till today: ${res.summary.dueTillDate} · Full-year due: ${res.summary.due}`],
    );
  }

  private async ptmRows(q: ReportQueryDto, scope: RequestScope) {
    if (!q.classId) throw new BadRequestException('Choose a class');
    return this.loadEnrollments(q, scope);
  }

  /**
   * Installment-wise collection: one row per student with payable / paid / due for every
   * installment, plus a grand-total row. Title lines summarise each installment.
   */
  private async installmentWise(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const rows = await this.ledger.bulk({ sessionId: scope.sessionId, mediumId: scope.mediumId, classId: q.classId, sectionId: q.sectionId });
    const insts = rows[0]?.installments ?? [];
    if (!insts.length) throw new BadRequestException('No fee installments are set up for this session (Fees → Fee Setup).');

    const columns: { header: string; key: string; width?: number; numFmt?: string }[] = [
      { header: 'Admission No', key: 'adm', width: 14 },
      { header: 'Student', key: 'name', width: 24 },
      { header: 'Class', key: 'cls', width: 10 },
      { header: "Father's name", key: 'father', width: 20 },
      { header: 'Mobile', key: 'mobile', width: 12 },
    ];
    insts.forEach((i, n) => {
      columns.push({ header: `${i.name} · Payable`, key: `p${n}`, width: 14, numFmt: MONEY_FMT });
      columns.push({ header: `${i.name} · Paid`, key: `c${n}`, width: 13, numFmt: MONEY_FMT });
      columns.push({ header: `${i.name} · Due`, key: `d${n}`, width: 12, numFmt: MONEY_FMT });
    });
    columns.push({ header: 'Total payable', key: 'tp', width: 14, numFmt: MONEY_FMT }, { header: 'Total paid', key: 'tc', width: 13, numFmt: MONEY_FMT }, { header: 'Total due', key: 'td', width: 12, numFmt: MONEY_FMT });

    const sum = { p: insts.map(() => 0), c: insts.map(() => 0), d: insts.map(() => 0) };
    const data = rows.map((r) => {
      const row: Record<string, unknown> = {
        adm: r.student?.admissionNo,
        name: r.student?.name,
        cls: `${r.schoolClass?.name ?? ''}${r.section ? '-' + r.section.name : ''}`,
        father: r.student?.fatherName,
        mobile: r.student?.fatherMobile,
        tp: r.totals.payable,
        tc: r.totals.paid,
        td: r.totals.due,
      };
      r.installments.forEach((i, n) => {
        row[`p${n}`] = i.payable;
        row[`c${n}`] = i.paid;
        row[`d${n}`] = i.due;
        sum.p[n] += i.payable;
        sum.c[n] += i.paid;
        sum.d[n] += i.due;
      });
      return row;
    });
    const totalRow: Record<string, unknown> = { name: 'TOTAL', tp: toMoney(sum.p.reduce((a, b) => a + b, 0)), tc: toMoney(sum.c.reduce((a, b) => a + b, 0)), td: toMoney(sum.d.reduce((a, b) => a + b, 0)) };
    insts.forEach((_, n) => {
      totalRow[`p${n}`] = toMoney(sum.p[n]);
      totalRow[`c${n}`] = toMoney(sum.c[n]);
      totalRow[`d${n}`] = toMoney(sum.d[n]);
    });
    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '-');
    return buildSheet('Installment-wise', columns, [...data, {}, totalRow], [
      `Installment-wise fee collection — Session ${session ?? ''}`,
      `Students: ${rows.length}`,
      ...insts.map((i, n) => `${i.name} (due ${fmtDate(i.dueDate)}): payable ${toMoney(sum.p[n])} · collected ${toMoney(sum.c[n])} (${pct(sum.c[n], sum.p[n])}) · due ${toMoney(sum.d[n])}`),
    ]);
  }

  private async ptm(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const enrs = await this.ptmRows(q, scope);
    return buildSheet(
      'PTM',
      [
        { header: 'Roll', key: 'roll', width: 6 },
        { header: 'Student', key: 'name', width: 24 },
        { header: 'Father', key: 'father', width: 22 },
        { header: 'Mobile', key: 'mobile', width: 13 },
        { header: 'Remarks', key: 'remarks', width: 30 },
        { header: 'Parent signature', key: 'sign', width: 20 },
      ],
      enrs.map((e) => ({ roll: e.rollNo, name: e.student!.name, father: e.student!.fatherName, mobile: e.student!.fatherMobile })),
      [`Parent-Teacher Meeting — Session ${session ?? ''}`, `Class ${enrs[0]?.schoolClass?.name ?? ''}`],
    );
  }

  private async ptmPdf(q: ReportQueryDto, scope: RequestScope, session?: string) {
    const [enrs, school] = await Promise.all([this.ptmRows(q, scope), this.settings.get('school')]);
    return renderPdf((doc) => {
      const W = doc.page.width - 72;
      let y = letterhead(doc, school, 36, 36, W);
      const cls = enrs[0] ? `${enrs[0].schoolClass?.name ?? ''}${q.sectionId && enrs[0].section ? '-' + enrs[0].section.name : ''}` : '';
      doc.font('Helvetica-Bold').fontSize(12).text(`PARENT-TEACHER MEETING — CLASS ${cls} — SESSION ${session ?? ''}`, 36, y, { width: W, align: 'center' });
      doc.font('Helvetica').fontSize(9).text('Date: ____________', 36, y + 18, { width: W, align: 'right' });
      y += 36;
      table(
        doc,
        36,
        y,
        [
          { header: 'Roll', width: 34, align: 'center' },
          { header: 'Student', width: 130 },
          { header: 'Father', width: 120 },
          { header: 'Mobile', width: 72 },
          { header: 'Remarks', width: W - 34 - 130 - 120 - 72 - 90 },
          { header: 'Signature', width: 90 },
        ],
        enrs.map((e) => [String(e.rollNo ?? ''), e.student!.name, e.student!.fatherName ?? '', e.student!.fatherMobile ?? '', '', '']),
        { rowHeight: 22, fontSize: 8.5 },
      );
    }, { layout: 'portrait' });
  }
}
