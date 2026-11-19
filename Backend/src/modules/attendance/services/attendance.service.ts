import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { createHash, randomBytes } from 'crypto';
import ExcelJS from 'exceljs';
import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { AuditService } from '../../admin/services/audit.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { StaffService } from '../../staff/services/staff.service';
import { Student } from '../../students/entities/student.entity';
import { BiometricPunchDto, CreateDeviceDto, CreateHolidayDto, MarkAttendanceDto, RegisterQueryDto, SheetQueryDto } from '../dto/attendance.dto';
import { Attendance, ATTENDANCE_STATUSES, AttendanceStatus, BiometricDevice, Holiday } from '../entities/attendance.entities';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const todayStr = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance) private readonly attendance: typeof Attendance,
    @InjectModel(Holiday) private readonly holidays: typeof Holiday,
    @InjectModel(BiometricDevice) private readonly devices: typeof BiometricDevice,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    private readonly audit: AuditService,
    private readonly staffService: StaffService,
  ) {}

  // ---------- daily sheet ----------
  async sheet(q: SheetQueryDto, scope: RequestScope) {
    await this.assertDateInSession(q.date, scope.sessionId);
    const mediumId = q.mediumId ?? scope.mediumId;
    const where: WhereOptions = { sessionId: scope.sessionId, classId: q.classId, status: { [Op.ne]: 'left' } };
    if (mediumId) Object.assign(where, { mediumId });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });

    const [enrs, holiday] = await Promise.all([
      this.enrollments.findAll({
        where,
        attributes: ['id', 'rollNo', 'mediumId', 'sectionId'],
        include: [{ model: Student, attributes: ['id', 'name', 'admissionNo', 'photoPath'], required: true }],
        order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
      }),
      this.holidays.findOne({ where: { sessionId: scope.sessionId, date: q.date } }),
    ]);
    const marks = enrs.length
      ? await this.attendance.findAll({
          where: { date: q.date, enrollmentId: enrs.map((e) => e.id) },
          attributes: ['enrollmentId', 'status', 'source', 'inTime'],
        })
      : [];
    const markBy = new Map(marks.map((a) => [a.enrollmentId, a]));

    const rows = enrs.map((e) => {
      const a = markBy.get(e.id);
      return { enrollmentId: e.id, rollNo: e.rollNo, student: e.student, status: a?.status ?? null, source: a?.source ?? null, inTime: a?.inTime ?? null };
    });
    const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
    return {
      date: q.date,
      holiday: holiday ? holiday.title : new Date(q.date).getDay() === 0 ? 'Sunday' : null,
      rows,
      summary: { total: rows.length, P: count('P'), A: count('A'), L: count('L'), HD: count('HD'), unmarked: rows.filter((r) => !r.status).length },
    };
  }

  /** Bulk upsert one day's attendance. Manual marks override biometric ones. */
  async mark(dto: MarkAttendanceDto, scope: RequestScope, actor: AuthUser) {
    await this.assertDateInSession(dto.date, scope.sessionId);
    if (dto.date > todayStr()) throw new BadRequestException('Cannot mark attendance for a future date');

    const ids = [...new Set(dto.records.map((r) => r.enrollmentId))];
    const valid = await this.enrollments.count({ where: { id: ids, sessionId: scope.sessionId } });
    if (valid !== ids.length) throw new BadRequestException('Some students are not enrolled in this session');

    await this.attendance.bulkCreate(
      dto.records.map((r) => ({ sessionId: scope.sessionId, enrollmentId: r.enrollmentId, date: dto.date, status: r.status, source: 'manual', markedBy: actor.id })),
      { updateOnDuplicate: ['status', 'source', 'markedBy', 'updatedAt'] },
    );
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'mark', entity: 'attendance', meta: { date: dto.date, count: dto.records.length } });
    return { saved: dto.records.length };
  }

  // ---------- monthly register ----------
  async register(q: RegisterQueryDto, scope: RequestScope) {
    const [y, m] = q.month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const from = `${q.month}-01`;
    const to = `${q.month}-${String(days).padStart(2, '0')}`;
    const mediumId = q.mediumId ?? scope.mediumId;

    const where: WhereOptions = { sessionId: scope.sessionId, classId: q.classId };
    if (mediumId) Object.assign(where, { mediumId });
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });

    const [enrs, marks, hols] = await Promise.all([
      this.enrollments.findAll({
        where,
        attributes: ['id', 'rollNo'],
        include: [{ model: Student, attributes: ['id', 'name', 'admissionNo'], required: true }],
        order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
      }),
      this.attendance.findAll({
        where: { sessionId: scope.sessionId, date: { [Op.between]: [from, to] } },
        attributes: ['enrollmentId', 'date', 'status'],
        include: [{ model: StudentEnrollment, attributes: [], where, required: true }],
        raw: true,
      }),
      this.holidays.findAll({ where: { sessionId: scope.sessionId, date: { [Op.between]: [from, to] } } }),
    ]);

    const byEnr = new Map<number, Record<number, AttendanceStatus>>();
    for (const r of marks) {
      const d = Number(String(r.date).slice(8, 10));
      if (!byEnr.has(r.enrollmentId)) byEnr.set(r.enrollmentId, {});
      byEnr.get(r.enrollmentId)![d] = r.status;
    }
    const holidaySet = new Map(hols.map((h) => [Number(h.date.slice(8, 10)), h.title]));
    const offDays: Record<number, string> = {};
    for (let d = 1; d <= days; d++) {
      if (holidaySet.has(d)) offDays[d] = holidaySet.get(d)!;
      else if (new Date(y, m - 1, d).getDay() === 0) offDays[d] = 'Sunday';
    }

    const rows = enrs.map((e) => {
      const marksFor = byEnr.get(e.id) ?? {};
      const vals = Object.values(marksFor);
      const present = vals.filter((v) => v === 'P').length + vals.filter((v) => v === 'HD').length * 0.5;
      const marked = vals.length;
      return {
        enrollmentId: e.id,
        rollNo: e.rollNo,
        student: e.student,
        days: marksFor,
        present,
        absent: vals.filter((v) => v === 'A').length,
        leave: vals.filter((v) => v === 'L').length,
        percent: marked ? Math.round((present / marked) * 1000) / 10 : null,
      };
    });
    return { month: q.month, days, offDays, rows };
  }

  /** Per-month totals for one student (parent portal / profile) */
  async studentSummary(enrollmentId: number, sessionId: number) {
    const rows = (await this.attendance.findAll({
      where: { enrollmentId, sessionId },
      attributes: [
        [this.attendance.sequelize!.fn('DATE_FORMAT', this.attendance.sequelize!.col('date'), '%Y-%m'), 'month'],
        'status',
        [this.attendance.sequelize!.fn('COUNT', this.attendance.sequelize!.col('id')), 'count'],
      ],
      group: ['month', 'status'],
      raw: true,
    })) as unknown as { month: string; status: AttendanceStatus; count: number }[];
    const months: Record<string, Record<AttendanceStatus, number>> = {};
    for (const r of rows) (months[r.month] ||= { P: 0, A: 0, L: 0, HD: 0 })[r.status] = Number(r.count);
    const list = Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, c]) => {
        const total = c.P + c.A + c.L + c.HD;
        return { month, ...c, total, percent: total ? Math.round(((c.P + c.HD * 0.5) / total) * 1000) / 10 : null };
      });
    const tot = list.reduce((n, r) => ({ P: n.P + r.P, A: n.A + r.A, L: n.L + r.L, HD: n.HD + r.HD }), { P: 0, A: 0, L: 0, HD: 0 });
    const all = tot.P + tot.A + tot.L + tot.HD;
    // Day-wise list for the calendar view (one row per marked day, so at most ~250 per session)
    const days = (await this.attendance.findAll({ where: { enrollmentId, sessionId }, attributes: ['date', 'status'], order: [['date', 'ASC']], raw: true })) as unknown as { date: string; status: AttendanceStatus }[];
    return { months: list, days, totals: { ...tot, total: all, percent: all ? Math.round(((tot.P + tot.HD * 0.5) / all) * 1000) / 10 : null } };
  }

  /** Today's numbers for the dashboard */
  async today(scope: RequestScope) {
    const date = todayStr();
    const enrWhere: WhereOptions = { sessionId: scope.sessionId, status: 'studying' };
    if (scope.mediumId) Object.assign(enrWhere, { mediumId: scope.mediumId });
    const rows = (await this.attendance.findAll({
      where: { sessionId: scope.sessionId, date },
      attributes: ['status', [this.attendance.sequelize!.fn('COUNT', this.attendance.sequelize!.col('Attendance.id')), 'count']],
      include: [{ model: StudentEnrollment, attributes: [], where: enrWhere, required: true }],
      group: ['status'],
      raw: true,
    })) as unknown as { status: AttendanceStatus; count: number }[];
    const c = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
    for (const r of rows) c[r.status] = Number(r.count);
    return { date, ...c, marked: c.P + c.A + c.L + c.HD };
  }

  // ---------- holidays ----------
  listHolidays(scope: RequestScope) {
    return this.holidays.findAll({ where: { sessionId: scope.sessionId }, order: [['date', 'ASC']] });
  }

  async createHoliday(dto: CreateHolidayDto, scope: RequestScope, actor: AuthUser) {
    await this.assertDateInSession(dto.date, scope.sessionId);
    try {
      const h = await this.holidays.create({ ...dto, sessionId: scope.sessionId });
      this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'holiday', entityId: h.id });
      return h;
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('A holiday already exists on this date');
      throw e;
    }
  }

  async removeHoliday(id: number, scope: RequestScope, actor: AuthUser) {
    const n = await this.holidays.destroy({ where: { id, sessionId: scope.sessionId } });
    if (!n) throw new NotFoundException('Holiday not found');
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'delete', entity: 'holiday', entityId: id });
    return { id };
  }

  // ---------- Excel import ----------
  /** Columns: Admission No | Date (YYYY-MM-DD) | Status (P/A/L/HD) */
  async importExcel(buffer: Buffer, scope: RequestScope, actor: AuthUser) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('The file has no sheet');

    const parsed: { adm: string; date: string; status: AttendanceStatus; row: number }[] = [];
    const errors: string[] = [];
    ws.eachRow((row, i) => {
      if (i === 1) return; // header
      const adm = String(row.getCell(1).text ?? '').trim();
      const rawDate = row.getCell(2).value;
      const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(row.getCell(2).text ?? '').trim();
      const status = String(row.getCell(3).text ?? '').trim().toUpperCase() as AttendanceStatus;
      if (!adm && !date) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`Row ${i}: invalid date`);
      else if (!ATTENDANCE_STATUSES.includes(status)) errors.push(`Row ${i}: status must be P, A, L or HD`);
      else parsed.push({ adm, date, status, row: i });
    });
    if (parsed.length > 20000) throw new BadRequestException('Max 20,000 rows per file');

    const enrs = await this.enrollments.findAll({
      where: { sessionId: scope.sessionId },
      attributes: ['id'],
      include: [{ model: Student, attributes: ['admissionNo'], where: { admissionNo: [...new Set(parsed.map((p) => p.adm))] }, required: true }],
    });
    const byAdm = new Map(enrs.map((e) => [e.student!.admissionNo, e.id]));
    const records: { sessionId: number; enrollmentId: number; date: string; status: AttendanceStatus; source: 'manual'; markedBy: number }[] = [];
    for (const p of parsed) {
      const id = byAdm.get(p.adm);
      if (!id) errors.push(`Row ${p.row}: admission no ${p.adm} not enrolled in this session`);
      else records.push({ sessionId: scope.sessionId, enrollmentId: id, date: p.date, status: p.status, source: 'manual' as const, markedBy: actor.id });
    }
    if (records.length) await this.attendance.bulkCreate(records, { updateOnDuplicate: ['status', 'source', 'markedBy', 'updatedAt'] });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'import', entity: 'attendance', meta: { saved: records.length, errors: errors.length } });
    return { saved: records.length, errors: errors.slice(0, 100), errorCount: errors.length };
  }

  // ---------- biometric devices ----------
  listDevices() {
    return this.devices.findAll({ attributes: ['id', 'name', 'isActive', 'lastSeenAt', 'createdAt'], order: [['id', 'ASC']] });
  }

  /** The plain key is shown ONCE; only its hash is stored */
  async createDevice(dto: CreateDeviceDto, actor: AuthUser) {
    const key = dto.apiKey?.trim() || `bio_${randomBytes(24).toString('base64url')}`;
    if (await this.devices.count({ where: { keyHash: sha256(key) } })) throw new BadRequestException('Another device already uses this key');
    const d = await this.devices.create({ name: dto.name, keyHash: sha256(key) });
    this.audit.log({ userId: actor.id, action: 'create', entity: 'biometric_device', entityId: d.id });
    return { id: d.id, name: d.name, apiKey: key };
  }

  async toggleDevice(id: number, isActive: boolean, actor: AuthUser) {
    const d = await this.devices.findByPk(id);
    if (!d) throw new NotFoundException('Device not found');
    await d.update({ isActive });
    this.audit.log({ userId: actor.id, action: isActive ? 'enable' : 'disable', entity: 'biometric_device', entityId: id });
    return { id, isActive };
  }

  async removeDevice(id: number, actor: AuthUser) {
    const n = await this.devices.destroy({ where: { id } });
    if (!n) throw new NotFoundException('Device not found');
    this.audit.log({ userId: actor.id, action: 'delete', entity: 'biometric_device', entityId: id });
    return { id };
  }

  /**
   * Machine push endpoint. Authenticated by device API key (not a user login).
   * First punch of the day marks Present; existing marks (incl. manual) are never overwritten.
   * Parameterised queries throughout — the old Joomla endpoint was SQL-injectable.
   */
  async ingest(apiKey: string | undefined, body: unknown) {
    if (!apiKey) throw new UnauthorizedException('Missing device key');
    const device = await this.devices.findOne({ where: { keyHash: sha256(apiKey), isActive: true } });
    if (!device) throw new UnauthorizedException('Invalid device key');

    const list = Array.isArray(body) ? body : [body];
    if (list.length > 2000) throw new BadRequestException('Max 2000 punches per request');

    const punches: { p: BiometricPunchDto; date: string; time: string }[] = [];
    const results: { txnId?: string; status: 'ok' | 'skipped' | 'error'; reason?: string }[] = [];
    for (const raw of list) {
      const p = plainToInstance(BiometricPunchDto, raw);
      const errs = await validate(p);
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/.exec(p?.txnDateTime ?? '');
      if (errs.length || !m) {
        results.push({ txnId: p?.txnId, status: 'error', reason: 'invalid punch' });
        continue;
      }
      punches.push({ p, date: m[1], time: m[2].length === 5 ? `${m[2]}:00` : m[2] });
      results.push({ txnId: p.txnId, status: 'ok' });
    }

    const students = await this.students.findAll({ where: { biometricId: [...new Set(punches.map((x) => x.p.punchId))] }, attributes: ['id', 'biometricId'] });
    const studentBy = new Map(students.map((s) => [s.biometricId, s.id]));
    const sessions = await this.sessions.findAll({ where: { isActive: true }, attributes: ['id', 'startDate', 'endDate'] });
    const sessionFor = (date: string) => sessions.find((s) => s.startDate <= date && s.endDate >= date)?.id;

    // One query for all enrollments of the punched students
    const enrRows = students.length
      ? await this.enrollments.findAll({ where: { studentId: students.map((s) => s.id) }, attributes: ['id', 'studentId', 'sessionId'] })
      : [];
    const enrBy = new Map(enrRows.map((e) => [`${e.studentId}:${e.sessionId}`, e.id]));

    const records: Record<string, unknown>[] = [];
    // punchIds that are not students may belong to staff
    const staffPending: { r: (typeof results)[number]; punchId: string; date: string; time: string }[] = [];
    let i = 0;
    for (const r of results) {
      if (r.status !== 'ok') continue;
      const { p, date, time } = punches[i++];
      const studentId = studentBy.get(p.punchId);
      const sessionId = sessionFor(date);
      if (!studentId) staffPending.push({ r, punchId: p.punchId, date, time });
      if (!studentId || !sessionId) {
        r.status = 'skipped';
        r.reason = !studentId ? 'unknown punchId' : 'date outside any session';
        continue;
      }
      const enrollmentId = enrBy.get(`${studentId}:${sessionId}`);
      if (!enrollmentId) {
        r.status = 'skipped';
        r.reason = 'not enrolled';
        continue;
      }
      records.push({ sessionId, enrollmentId, date, status: 'P', source: 'biometric', inTime: time });
    }
    if (records.length) await this.attendance.bulkCreate(records, { ignoreDuplicates: true });
    const staffMatched = await this.staffService.ingestPunches(staffPending.map(({ punchId, date, time }) => ({ punchId, date, time })));
    let staffSaved = 0;
    for (const x of staffPending)
      if (staffMatched.has(x.punchId)) {
        x.r.status = 'ok';
        x.r.reason = 'staff';
        staffSaved++;
      }
    await device.update({ lastSeenAt: new Date() });
    return { received: list.length, saved: records.length + staffSaved, results };
  }

  /**
   * Same request/response as the old site's /Api/attendence.php, so the machine keeps
   * working unchanged: POST ?apiKey=…  {"trans":[{txnId,dvcId,dvcIP,punchId,txnDateTime,mode}]}
   * → {"transStatus":[{txnId,status:1|0}]}. status 1 = accepted (the machine stops resending).
   */
  async ingestLegacy(apiKey: string | undefined, body: unknown) {
    const trans = (body as { trans?: unknown })?.trans;
    if (!Array.isArray(trans)) throw new BadRequestException('Body must be {"trans":[...]}');
    // The old API stamped server time; use it when the machine's time is missing/unparseable
    const now = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    const punches = trans.map((t: Record<string, unknown>) => {
      const dt = String(t?.txnDateTime ?? '');
      return {
        punchId: t?.punchId == null ? '' : String(t.punchId),
        txnId: t?.txnId == null ? undefined : String(t.txnId),
        txnDateTime: /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(dt) ? dt : now,
      };
    });
    // Like the old API: a punch without punchId or txnId is rejected (status 0)
    const valid = punches.filter((x) => x.punchId && x.txnId);
    const res = await this.ingest(apiKey, valid);
    const statusOf = new Map(res.results.map((r) => [r.txnId, r.status === 'error' ? 0 : 1]));
    return { transStatus: punches.map((x) => ({ txnId: x.txnId, status: x.punchId && x.txnId ? (statusOf.get(x.txnId) ?? 0) : 0 })) };
  }

  private async assertDateInSession(date: string, sessionId: number) {
    const s = await this.sessions.findByPk(sessionId, { attributes: ['startDate', 'endDate'] });
    if (!s || date < s.startDate || date > s.endDate) throw new BadRequestException('Date is outside the selected session');
  }
}
