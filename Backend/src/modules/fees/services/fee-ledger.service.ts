import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, WhereOptions } from 'sequelize';
import { toMoney } from '../../../common/utils/money';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SettingsService } from '../../admin/services/settings.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { TransportRoute } from '../../transport/entities/transport.entities';
import { FeeConcession, FeeHead, FeeInstallment, FeePayment, FeePaymentItem, FeeStructure } from '../entities/fee.entities';

export interface LedgerLine {
  installmentId: number;
  feeHeadId: number | null; // null = transport
  head: string;
  amount: number; // as per structure
  concession: number;
  payable: number; // amount - concession
  paid: number;
  due: number; // payable - paid (never negative)
}

export interface LedgerInstallment {
  id: number;
  name: string;
  dueDate: string;
  overdue: boolean;
  lines: LedgerLine[];
  totals: { payable: number; paid: number; due: number };
}

export interface Ledger {
  installments: LedgerInstallment[];
  totals: { amount: number; concession: number; payable: number; paid: number; due: number; dueTillDate: number };
  concession: { type: 'percent' | 'fixed'; value: number; reason: string | null } | null;
  overdueInstallments: number;
  suggestedFine: number;
  fullPaymentDiscount: number; // allowed discount if everything is cleared now
}

const key = (inst: number, head: number | null) => `${inst}:${head ?? 'T'}`;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Pure calculation shared by the single-student ledger and the bulk dues report,
 * so both always agree.
 */
export function computeLedger(input: {
  installments: { id: number; name: string; dueDate: string }[];
  structure: { installmentId: number; feeHeadId: number; amount: number; head: string; appliesTo: 'all' | 'hostel' }[];
  isHostel: boolean;
  transportAnnual: number;
  concession: { type: 'percent' | 'fixed'; value: number } | null;
  paid: Map<string, number>;
  asOf?: string;
}): Omit<Ledger, 'concession' | 'suggestedFine' | 'fullPaymentDiscount'> & { _lines: LedgerLine[] } {
  const asOf = input.asOf ?? today();
  const raw: Omit<LedgerLine, 'concession' | 'payable' | 'paid' | 'due'>[] = [];

  for (const s of input.structure) {
    if (s.appliesTo === 'hostel' && !input.isHostel) continue;
    raw.push({ installmentId: s.installmentId, feeHeadId: s.feeHeadId, head: s.head, amount: toMoney(s.amount) });
  }
  // Transport: annual route fee split equally, remainder on the last installment
  if (input.transportAnnual > 0 && input.installments.length) {
    const n = input.installments.length;
    const each = Math.floor((input.transportAnnual / n) * 100) / 100;
    input.installments.forEach((inst, i) => {
      const amt = i === n - 1 ? toMoney(input.transportAnnual - each * (n - 1)) : each;
      raw.push({ installmentId: inst.id, feeHeadId: null, head: 'Transport', amount: amt });
    });
  }

  // Concession spread across lines (percent per line; fixed proportionally, rounding fixed on the largest line)
  const gross = toMoney(raw.reduce((n, l) => n + l.amount, 0));
  const conc = raw.map((l) => {
    if (!input.concession || gross === 0) return 0;
    if (input.concession.type === 'percent') return toMoney((l.amount * Math.min(input.concession.value, 100)) / 100);
    return toMoney((l.amount / gross) * Math.min(input.concession.value, gross));
  });
  if (input.concession?.type === 'fixed' && raw.length) {
    const target = toMoney(Math.min(input.concession.value, gross));
    const diff = toMoney(target - conc.reduce((n, c) => n + c, 0));
    if (diff !== 0) {
      const iMax = raw.reduce((best, l, i) => (l.amount > raw[best].amount ? i : best), 0);
      conc[iMax] = toMoney(conc[iMax] + diff);
    }
  }

  const lines: LedgerLine[] = raw.map((l, i) => {
    const payable = toMoney(l.amount - conc[i]);
    const paid = toMoney(input.paid.get(key(l.installmentId, l.feeHeadId)) ?? 0);
    return { ...l, concession: conc[i], payable, paid, due: Math.max(0, toMoney(payable - paid)) };
  });

  const installments: LedgerInstallment[] = input.installments.map((inst) => {
    const ls = lines.filter((l) => l.installmentId === inst.id);
    const due = toMoney(ls.reduce((n, l) => n + l.due, 0));
    return {
      id: inst.id,
      name: inst.name,
      dueDate: inst.dueDate,
      overdue: due > 0 && inst.dueDate < asOf,
      lines: ls,
      totals: {
        payable: toMoney(ls.reduce((n, l) => n + l.payable, 0)),
        paid: toMoney(ls.reduce((n, l) => n + l.paid, 0)),
        due,
      },
    };
  });

  const sum = (f: (l: LedgerLine) => number) => toMoney(lines.reduce((n, l) => n + f(l), 0));
  const dueTillDate = toMoney(installments.filter((i) => i.dueDate <= asOf).reduce((n, i) => n + i.totals.due, 0));

  return {
    installments,
    totals: { amount: sum((l) => l.amount), concession: sum((l) => l.concession), payable: sum((l) => l.payable), paid: sum((l) => l.paid), due: sum((l) => l.due), dueTillDate },
    overdueInstallments: installments.filter((i) => i.overdue).length,
    _lines: lines,
  };
}

@Injectable()
export class FeeLedgerService {
  constructor(
    @InjectModel(FeeInstallment) private readonly installments: typeof FeeInstallment,
    @InjectModel(FeeStructure) private readonly structures: typeof FeeStructure,
    @InjectModel(FeeConcession) private readonly concessions: typeof FeeConcession,
    @InjectModel(FeePaymentItem) private readonly items: typeof FeePaymentItem,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(TransportRoute) private readonly routes: typeof TransportRoute,
    private readonly settings: SettingsService,
  ) {}

  /** Ledger for one enrollment. Pass a transaction to read consistently while collecting. */
  async forEnrollment(enrollmentId: number, sessionId: number, transaction?: Transaction): Promise<Ledger & { enrollment: StudentEnrollment }> {
    const enr = await this.enrollments.findOne({
      where: { id: enrollmentId, sessionId },
      include: [
        { model: Student, attributes: ['id', 'name', 'admissionNo', 'fatherName', 'fatherMobile', 'photoPath'] },
        { model: SchoolClass, attributes: ['id', 'name'] },
        { model: Section, attributes: ['id', 'name'] },
        { model: Medium, attributes: ['id', 'name'] },
      ],
      transaction,
    });
    if (!enr) throw new NotFoundException('Student is not enrolled in this session');

    const [insts, struct, conc, route, paidRows, feeSettings] = await Promise.all([
      this.installments.findAll({ where: { sessionId }, order: [['sortOrder', 'ASC'], ['dueDate', 'ASC']], transaction }),
      this.structures.findAll({
        where: { sessionId, classId: enr.classId, mediumId: enr.mediumId },
        include: [{ model: FeeHead, attributes: ['name', 'appliesTo', 'sortOrder'] }],
        transaction,
      }),
      this.concessions.findOne({ where: { enrollmentId }, transaction }),
      enr.transportRouteId ? this.routes.findByPk(enr.transportRouteId, { transaction }) : null,
      this.items.findAll({
        attributes: ['installmentId', 'feeHeadId', [this.items.sequelize!.fn('SUM', this.items.sequelize!.col('amount')), 'total']],
        include: [{ model: FeePayment, attributes: [], where: { enrollmentId, status: 'paid' }, required: true }],
        group: ['installmentId', 'feeHeadId'],
        raw: true,
        transaction,
      }) as unknown as Promise<{ installmentId: number; feeHeadId: number | null; total: string }[]>,
      this.settings.get('fees'),
    ]);

    const paid = new Map(paidRows.map((p) => [key(p.installmentId, p.feeHeadId), toMoney(p.total)]));
    const result = computeLedger({
      installments: insts.map((i) => ({ id: i.id, name: i.name, dueDate: i.dueDate })),
      structure: struct
        .sort((a, b) => (a.feeHead!.sortOrder ?? 0) - (b.feeHead!.sortOrder ?? 0))
        .map((s) => ({ installmentId: s.installmentId, feeHeadId: s.feeHeadId, amount: toMoney(s.amount), head: s.feeHead!.name, appliesTo: s.feeHead!.appliesTo })),
      isHostel: enr.isHostel,
      transportAnnual: route?.isActive !== false ? toMoney(route?.annualFee) : 0,
      concession: conc ? { type: conc.type, value: toMoney(conc.value) } : null,
      paid,
    });

    const { _lines, ...rest } = result;
    return {
      ...rest,
      enrollment: enr,
      concession: conc ? { type: conc.type, value: toMoney(conc.value), reason: conc.reason } : null,
      suggestedFine: toMoney(feeSettings.lateFeePerInstallment * rest.overdueInstallments),
      fullPaymentDiscount: toMoney((rest.totals.due * feeSettings.fullPaymentDiscountPercent) / 100),
    };
  }

  /**
   * Dues for every studying enrollment in the scope. Set-based: a fixed number of
   * queries regardless of student count, then the shared pure calculation.
   */
  async bulk(opts: { sessionId: number; mediumId?: number | null; classId?: number; sectionId?: number; search?: string; asOf?: string; enrollmentIds?: number[] }) {
    const where: WhereOptions = { sessionId: opts.sessionId, status: 'studying' };
    if (opts.mediumId) Object.assign(where, { mediumId: opts.mediumId });
    if (opts.classId) Object.assign(where, { classId: opts.classId });
    if (opts.sectionId) Object.assign(where, { sectionId: opts.sectionId });
    if (opts.enrollmentIds?.length) Object.assign(where, { id: opts.enrollmentIds });
    const studentWhere: WhereOptions = opts.search
      ? { [Op.or]: [{ name: { [Op.like]: `%${opts.search}%` } }, { admissionNo: { [Op.like]: `%${opts.search}%` } }, { fatherMobile: { [Op.like]: `%${opts.search}%` } }] }
      : {};

    const [enrs, insts, struct, routes, concs, paidRows] = await Promise.all([
      this.enrollments.findAll({
        where,
        include: [
          { model: Student, attributes: ['id', 'name', 'admissionNo', 'fatherName', 'fatherMobile', 'gender', 'photoPath'], where: studentWhere, required: true },
          { model: SchoolClass, attributes: ['id', 'name', 'sortOrder'] },
          { model: Section, attributes: ['id', 'name'] },
          { model: Medium, attributes: ['id', 'name'] },
        ],
        order: [[{ model: SchoolClass, as: 'schoolClass' }, 'sortOrder', 'ASC'], ['rollNo', 'ASC']],
      }),
      this.installments.findAll({ where: { sessionId: opts.sessionId }, order: [['sortOrder', 'ASC'], ['dueDate', 'ASC']] }),
      this.structures.findAll({ where: { sessionId: opts.sessionId }, include: [{ model: FeeHead, attributes: ['name', 'appliesTo'] }] }),
      this.routes.findAll({ where: { sessionId: opts.sessionId } }),
      this.concessions.sequelize!.query(
        'SELECT c.enrollment_id AS enrollmentId, c.type, c.value FROM fee_concessions c JOIN student_enrollments e ON e.id = c.enrollment_id WHERE e.session_id = ?',
        { replacements: [opts.sessionId], type: 'SELECT' },
      ) as unknown as Promise<{ enrollmentId: number; type: 'percent' | 'fixed'; value: string }[]>,
      this.items.findAll({
        attributes: [
          [this.items.sequelize!.col('payment.enrollment_id'), 'enrollmentId'],
          'installmentId',
          'feeHeadId',
          [this.items.sequelize!.fn('SUM', this.items.sequelize!.col('amount')), 'total'],
        ],
        include: [{ model: FeePayment, attributes: [], where: { sessionId: opts.sessionId, status: 'paid' }, required: true }],
        group: ['payment.enrollment_id', 'installmentId', 'feeHeadId'],
        raw: true,
      }) as unknown as Promise<{ enrollmentId: number; installmentId: number; feeHeadId: number | null; total: string }[]>,
    ]);

    const instList = insts.map((i) => ({ id: i.id, name: i.name, dueDate: i.dueDate }));
    const structBy = new Map<string, { installmentId: number; feeHeadId: number; amount: number; head: string; appliesTo: 'all' | 'hostel' }[]>();
    for (const s of struct) {
      const k = `${s.classId}:${s.mediumId}`;
      if (!structBy.has(k)) structBy.set(k, []);
      structBy.get(k)!.push({ installmentId: s.installmentId, feeHeadId: s.feeHeadId, amount: toMoney(s.amount), head: s.feeHead!.name, appliesTo: s.feeHead!.appliesTo });
    }
    const routeFee = new Map(routes.map((r) => [r.id, r.isActive ? toMoney(r.annualFee) : 0]));
    const concBy = new Map(concs.map((c) => [c.enrollmentId, { type: c.type, value: toMoney(c.value) }]));
    const paidBy = new Map<number, Map<string, number>>();
    for (const p of paidRows) {
      if (!paidBy.has(p.enrollmentId)) paidBy.set(p.enrollmentId, new Map());
      paidBy.get(p.enrollmentId)!.set(key(p.installmentId, p.feeHeadId), toMoney(p.total));
    }

    return enrs.map((e) => {
      const l = computeLedger({
        installments: instList,
        structure: structBy.get(`${e.classId}:${e.mediumId}`) ?? [],
        isHostel: e.isHostel,
        transportAnnual: e.transportRouteId ? (routeFee.get(e.transportRouteId) ?? 0) : 0,
        concession: concBy.get(e.id) ?? null,
        paid: paidBy.get(e.id) ?? new Map(),
        asOf: opts.asOf,
      });
      return {
        enrollmentId: e.id,
        student: e.student,
        schoolClass: e.schoolClass,
        section: e.section,
        medium: e.medium,
        rollNo: e.rollNo,
        totals: l.totals,
        overdueInstallments: l.overdueInstallments,
        /** Per-installment totals (installment-wise report) */
        installments: l.installments.map((i) => ({ id: i.id, name: i.name, dueDate: i.dueDate, overdue: i.overdue, ...i.totals })),
      };
    });
  }
}
