import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { AuthUser } from '../../../common/interfaces/request-context';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import { SettingsService } from '../../admin/services/settings.service';
import { CreateStaffDto, StaffListQueryDto, StaffMarkDto, UpdateStaffDto } from '../dto/staff.dto';
import { Staff, StaffAttendance, StaffAttendanceStatus } from '../entities/staff.entities';

/** Today's date / time in India (the server may run in UTC) */
const istNow = () => new Date(Date.now() + 5.5 * 3600_000).toISOString();
export const istToday = () => istNow().slice(0, 10);

const hhmmss = (t?: string | null) => (t ? (t.length === 5 ? `${t}:00` : t) : null);

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff) private readonly staff: typeof Staff,
    @InjectModel(StaffAttendance) private readonly attendance: typeof StaffAttendance,
    @InjectModel(User) private readonly users: typeof User,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- directory
  list(q: StaffListQueryDto) {
    const where: WhereOptions = {};
    if (!q.status || q.status === 'active') Object.assign(where, { isActive: true });
    if (q.status === 'inactive') Object.assign(where, { isActive: false });
    if (q.search) Object.assign(where, { [Op.or]: [{ name: { [Op.like]: `%${q.search}%` } }, { mobile: { [Op.like]: `%${q.search}%` } }, { biometricId: q.search }] });
    return this.staff.findAll({ where, include: [{ model: User, attributes: ['id', 'name', 'username'] }], order: [['name', 'ASC']] });
  }

  async create(dto: CreateStaffDto, actor: AuthUser) {
    await this.assertUser(dto.userId);
    const s = await this.guard(() => this.staff.create({ ...this.clean(dto) }));
    this.audit.log({ userId: actor.id, action: 'create', entity: 'staff', entityId: s.id });
    return s;
  }

  async update(id: number, dto: UpdateStaffDto, actor: AuthUser) {
    const s = await this.staff.findByPk(id);
    if (!s) throw new NotFoundException('Staff not found');
    if (dto.userId !== undefined) await this.assertUser(dto.userId);
    await this.guard(() => s.update(this.clean(dto)));
    this.audit.log({ userId: actor.id, action: 'update', entity: 'staff', entityId: id });
    return s;
  }

  // ---------------------------------------------------------------- attendance
  async settingsGet() {
    return this.settings.get('staff');
  }

  async settingsSet(lateAfter: string, actor: AuthUser) {
    return this.settings.set('staff', { lateAfter }, actor);
  }

  /** All active staff with their mark for one date (unmarked = null) */
  async day(date: string) {
    const [list, marks, cfg] = await Promise.all([
      this.staff.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'designation', 'mobile', 'biometricId'], order: [['name', 'ASC']] }),
      this.attendance.findAll({ where: { date } }),
      this.settings.get('staff'),
    ]);
    const by = new Map(marks.map((m) => [m.staffId, m]));
    const late = `${cfg.lateAfter}:00`;
    const rows = list.map((s) => {
      const m = by.get(s.id);
      return {
        staffId: s.id,
        name: s.name,
        designation: s.designation,
        mobile: s.mobile,
        biometricId: s.biometricId,
        status: m?.status ?? null,
        inTime: m?.inTime ?? null,
        outTime: m?.outTime ?? null,
        source: m?.source ?? null,
        late: !!(m && (m.status === 'P' || m.status === 'HD') && m.inTime && m.inTime > late),
      };
    });
    return { date, lateAfter: cfg.lateAfter, rows, summary: this.summarize(rows) };
  }

  private summarize(rows: { status: StaffAttendanceStatus | null; late: boolean }[]) {
    const c = (s: StaffAttendanceStatus) => rows.filter((r) => r.status === s).length;
    return { total: rows.length, P: c('P'), A: c('A'), L: c('L'), HD: c('HD'), late: rows.filter((r) => r.late).length, unmarked: rows.filter((r) => !r.status).length };
  }

  /** Manual marking; a manual mark replaces a biometric one for that day */
  async mark(dto: StaffMarkDto, actor: AuthUser) {
    if (dto.date > istToday()) throw new BadRequestException('Cannot mark attendance for a future date');
    const ids = [...new Set(dto.records.map((r) => r.staffId))];
    const ok = await this.staff.count({ where: { id: ids } });
    if (ok !== ids.length) throw new BadRequestException('Some staff were not found');

    const clear = dto.records.filter((r) => !r.status).map((r) => r.staffId);
    const set = dto.records.filter((r) => r.status);
    if (clear.length) await this.attendance.destroy({ where: { date: dto.date, staffId: clear } });
    if (set.length)
      await this.attendance.bulkCreate(
        set.map((r) => ({
          staffId: r.staffId,
          date: dto.date,
          status: r.status!,
          inTime: r.status === 'A' || r.status === 'L' ? null : hhmmss(r.inTime),
          outTime: r.status === 'A' || r.status === 'L' ? null : hhmmss(r.outTime),
          source: 'manual' as const,
          markedBy: actor.id,
        })),
        { updateOnDuplicate: ['status', 'inTime', 'outTime', 'source', 'markedBy', 'updatedAt'] },
      );
    this.audit.log({ userId: actor.id, action: 'mark', entity: 'staff_attendance', meta: { date: dto.date, count: dto.records.length } });
    return this.day(dto.date);
  }

  /** Month grid: one row per staff, one cell per day */
  async register(month: string) {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const from = `${month}-01`;
    const to = `${month}-${String(days).padStart(2, '0')}`;
    const [list, marks, cfg] = await Promise.all([
      this.staff.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'designation'], order: [['name', 'ASC']] }),
      this.attendance.findAll({ where: { date: { [Op.between]: [from, to] } }, attributes: ['staffId', 'date', 'status', 'inTime'] }),
      this.settings.get('staff'),
    ]);
    const late = `${cfg.lateAfter}:00`;
    const rows = list.map((s) => {
      const mine = marks.filter((x) => x.staffId === s.id);
      const cells: Record<number, { status: StaffAttendanceStatus; late: boolean } | null> = {};
      for (let d = 1; d <= days; d++) cells[d] = null;
      for (const x of mine) cells[Number(String(x.date).slice(8, 10))] = { status: x.status, late: (x.status === 'P' || x.status === 'HD') && !!x.inTime && x.inTime > late };
      const c = (st: StaffAttendanceStatus) => mine.filter((x) => x.status === st).length;
      return { staffId: s.id, name: s.name, designation: s.designation, cells, totals: { P: c('P'), A: c('A'), L: c('L'), HD: c('HD'), late: Object.values(cells).filter((v) => v?.late).length } };
    });
    return { month, days, rows };
  }

  /** Dashboard numbers for today */
  async today() {
    const d = await this.day(istToday());
    return { date: d.date, ...d.summary };
  }

  countActive() {
    return this.staff.count({ where: { isActive: true } });
  }

  // ---------------------------------------------------------------- biometric
  /**
   * Called from the biometric ingest for punchIds that are not students.
   * First punch of the day = in time (status P); later punches move the out time.
   * Never overwrites a manual mark. Returns the punchIds that matched a staff member.
   */
  async ingestPunches(punches: { punchId: string; date: string; time: string }[]) {
    if (!punches.length) return new Set<string>();
    const list = await this.staff.findAll({ where: { biometricId: [...new Set(punches.map((p) => p.punchId))], isActive: true }, attributes: ['id', 'biometricId'] });
    const idBy = new Map(list.map((s) => [s.biometricId!, s.id]));
    const matched = new Set<string>();
    for (const p of punches) {
      const staffId = idBy.get(p.punchId);
      if (!staffId) continue;
      matched.add(p.punchId);
      const row = await this.attendance.findOne({ where: { staffId, date: p.date } });
      if (!row) {
        await this.attendance.create({ staffId, date: p.date, status: 'P', inTime: p.time, source: 'biometric' }).catch(() => undefined);
      } else if (row.source === 'biometric') {
        const patch: Partial<StaffAttendance> = {};
        if (!row.inTime || p.time < row.inTime) {
          if (row.inTime && (!row.outTime || row.inTime > row.outTime)) patch.outTime = row.inTime;
          patch.inTime = p.time;
        } else if (p.time > row.inTime && (!row.outTime || p.time > row.outTime)) patch.outTime = p.time;
        if (Object.keys(patch).length) await row.update(patch);
      }
    }
    return matched;
  }

  // ---------------------------------------------------------------- helpers
  private clean(dto: UpdateStaffDto) {
    const out: Record<string, unknown> = { ...dto };
    for (const k of ['designation', 'mobile', 'biometricId', 'joiningDate']) if (out[k] === '') out[k] = null;
    if (typeof out.biometricId === 'string') out.biometricId = (out.biometricId as string).trim() || null;
    return out;
  }

  private async assertUser(userId?: number | null) {
    if (!userId) return;
    if (!(await this.users.count({ where: { id: userId } }))) throw new BadRequestException('Login account not found');
  }

  private async guard<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof UniqueConstraintError) {
        const f = Object.keys(e.fields ?? {}).join(', ');
        throw new ConflictException(f.includes('biometric') ? 'This biometric ID is already used by another staff member' : f.includes('user') ? 'This login is already linked to another staff member' : 'Duplicate value');
      }
      throw e;
    }
  }
}
