import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { SUPER_ADMIN_ROLE } from '../../../common/constants';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { join } from 'path';
import { HtmlPdfService } from '../../../common/pdf/html-pdf.service';
import { dMonY, dmy, dueSlipsHtml, receiptHtml } from '../../../common/pdf/print-templates';
import { Exam } from '../../exams/entities/exam.entities';
import { amountInWords, formatINR, toMoney } from '../../../common/utils/money';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import { RbacService } from '../../admin/services/rbac.service';
import { SettingsService } from '../../admin/services/settings.service';
import { SequenceService } from '../../../database/sequence.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';
import { CancelPaymentDto, CollectFeeDto, DueSlipQueryDto, DuesQueryDto, PaymentQueryDto } from '../dto/fee.dto';
import { FeeHead, FeeInstallment, FeePayment, FeePaymentItem } from '../entities/fee.entities';
import { FeeLedgerService } from './fee-ledger.service';

@Injectable()
export class FeeCollectionService {
  constructor(
    @InjectModel(FeePayment) private readonly payments: typeof FeePayment,
    @InjectModel(FeePaymentItem) private readonly items: typeof FeePaymentItem,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    @InjectModel(Exam) private readonly exams: typeof Exam,
    private readonly ledger: FeeLedgerService,
    private readonly sequences: SequenceService,
    private readonly settings: SettingsService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly sequelize: Sequelize,
    private readonly pdf: HtmlPdfService,
  ) {}

  /**
   * Collect fees. Serialised per student with SELECT … FOR UPDATE on the enrollment,
   * so two cashiers can never overpay the same line; every amount is re-validated
   * against the ledger inside the transaction.
   */
  async collect(dto: CollectFeeDto, scope: RequestScope, actor: AuthUser) {
    const payment = await this.sequelize.transaction(async (t) => {
      const locked = await this.enrollments.findOne({ where: { id: dto.enrollmentId, sessionId: scope.sessionId }, lock: t.LOCK.UPDATE, transaction: t });
      if (!locked) throw new NotFoundException('Student is not enrolled in this session');
      if (locked.status === 'left') throw new BadRequestException('Student has left — re-activate before collecting fees');

      const l = await this.ledger.forEnrollment(dto.enrollmentId, scope.sessionId, t);
      const dueByKey = new Map<string, number>();
      for (const inst of l.installments) for (const line of inst.lines) dueByKey.set(`${line.installmentId}:${line.feeHeadId ?? 'T'}`, line.due);

      const seen = new Set<string>();
      const items = dto.items
        .map((i) => ({ ...i, feeHeadId: i.feeHeadId ?? null, amount: toMoney(i.amount) }))
        .filter((i) => i.amount > 0);
      if (!items.length) throw new BadRequestException('Enter at least one amount');
      for (const i of items) {
        const k = `${i.installmentId}:${i.feeHeadId ?? 'T'}`;
        if (seen.has(k)) throw new BadRequestException('Duplicate fee line in the request');
        seen.add(k);
        const due = dueByKey.get(k);
        if (due === undefined) throw new BadRequestException('A fee line does not apply to this student');
        if (i.amount > due) throw new BadRequestException(`Amount exceeds the due (${formatINR(due)}) for one of the lines`);
      }

      const gross = toMoney(items.reduce((n, i) => n + i.amount, 0));
      const discount = toMoney(dto.discount ?? 0);
      const fine = toMoney(dto.fine ?? 0);
      if (discount > gross) throw new BadRequestException('Discount cannot exceed the amount');
      if (discount > 0) {
        const clearsAll = toMoney(gross) === toMoney(l.totals.due);
        const allowed = clearsAll && discount <= l.fullPaymentDiscount;
        if (!allowed && !(await this.canManage(actor))) {
          throw new BadRequestException(
            clearsAll
              ? `Maximum full-payment discount is ${formatINR(l.fullPaymentDiscount)}`
              : 'Discount is allowed only when all dues are cleared (or by a fee manager)',
          );
        }
      }

      const receiptNo = await this.nextReceiptNo(scope.sessionId, t);
      const p = await this.payments.create(
        {
          receiptNo,
          sessionId: scope.sessionId,
          mediumId: locked.mediumId,
          enrollmentId: locked.id,
          studentId: locked.studentId,
          paymentDate: dto.paymentDate,
          grossAmount: gross,
          discount,
          fine,
          netAmount: toMoney(gross - discount + fine),
          mode: dto.mode,
          reference: dto.reference ?? null,
          remarks: dto.remarks ?? null,
          collectedBy: actor.id,
        },
        { transaction: t },
      );
      await this.items.bulkCreate(
        items.map((i) => ({ paymentId: p.id, installmentId: i.installmentId, feeHeadId: i.feeHeadId, amount: i.amount })),
        { transaction: t },
      );
      return p;
    });

    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'collect', entity: 'fee_payment', entityId: payment.id, meta: { receiptNo: payment.receiptNo, net: payment.netAmount } });
    return this.findOne(payment.id, scope);
  }

  async cancel(id: number, dto: CancelPaymentDto, scope: RequestScope, actor: AuthUser) {
    const p = await this.payments.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!p) throw new NotFoundException('Receipt not found in this session');
    if (p.status === 'cancelled') throw new BadRequestException('Receipt is already cancelled');
    await p.update({ status: 'cancelled', cancelReason: dto.reason, cancelledBy: actor.id, cancelledAt: new Date() });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'cancel', entity: 'fee_payment', entityId: id, meta: { reason: dto.reason } });
    return this.findOne(id, scope);
  }

  async findOne(id: number, scope: RequestScope) {
    const p = await this.payments.findOne({
      where: { id, sessionId: scope.sessionId },
      include: [
        { model: Student, attributes: ['id', 'name', 'admissionNo', 'fatherName', 'fatherMobile', 'address', 'city'] },
        {
          model: StudentEnrollment,
          attributes: ['id', 'rollNo'],
          include: [
            { model: SchoolClass, attributes: ['id', 'name'] },
            { model: Section, attributes: ['id', 'name'] },
          ],
        },
        { model: Medium, attributes: ['id', 'name'] },
        { model: User, as: 'collector', attributes: ['id', 'name'] },
        {
          model: FeePaymentItem,
          include: [
            { model: FeeInstallment, attributes: ['id', 'name', 'sortOrder'] },
            { model: FeeHead, attributes: ['id', 'name', 'sortOrder'] },
          ],
        },
      ],
    });
    if (!p) throw new NotFoundException('Receipt not found in this session');
    return p;
  }

  async list(q: PaymentQueryDto, scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId };
    if (scope.mediumId) Object.assign(where, { mediumId: scope.mediumId });
    if (q.status) Object.assign(where, { status: q.status });
    if (q.mode) Object.assign(where, { mode: q.mode });
    if (q.from || q.to) Object.assign(where, { paymentDate: { ...(q.from ? { [Op.gte]: q.from } : {}), ...(q.to ? { [Op.lte]: q.to } : {}) } });
    if (q.search) {
      const s = `%${q.search}%`;
      Object.assign(where, { [Op.or]: [{ receiptNo: { [Op.like]: s } }, { '$student.name$': { [Op.like]: s } }, { '$student.admission_no$': { [Op.like]: s } }] });
    }
    const enrollmentWhere = q.classId ? { classId: q.classId } : undefined;

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const include = [
      { model: Student, attributes: ['id', 'name', 'admissionNo'] },
      { model: StudentEnrollment, attributes: ['id'], where: enrollmentWhere, include: [{ model: SchoolClass, attributes: ['name'] }, { model: Section, attributes: ['name'] }] },
      { model: User, as: 'collector', attributes: ['id', 'name'] },
    ];
    const [{ rows, count }, totals] = await Promise.all([
      this.payments.findAndCountAll({ where, include, order: [['paymentDate', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit, distinct: true, subQuery: false }),
      this.payments.findOne({
        where: { ...where, status: 'paid' },
        include: include.map((i) => ({ ...i, attributes: [] })),
        attributes: [
          [this.sequelize.fn('COALESCE', this.sequelize.fn('SUM', this.sequelize.col('net_amount')), 0), 'net'],
          [this.sequelize.fn('COUNT', this.sequelize.col('FeePayment.id')), 'receipts'],
        ],
        raw: true,
      }) as unknown as Promise<{ net: string; receipts: number }>,
    ]);
    return {
      items: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      summary: { net: toMoney(totals?.net), receipts: Number(totals?.receipts ?? 0) },
    };
  }

  /** Every student's dues in the scope, paged in memory (school-sized data) */
  async dues(q: DuesQueryDto, scope: RequestScope) {
    const all = await this.ledger.bulk({ sessionId: scope.sessionId, mediumId: scope.mediumId, classId: q.classId, sectionId: q.sectionId, search: q.search, asOf: q.asOf });
    const rows = q.onlyDue ? all.filter((r) => r.totals.dueTillDate > 0) : all;
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const sum = (f: (r: (typeof rows)[number]) => number) => toMoney(rows.reduce((n, r) => n + f(r), 0));
    return {
      items: rows.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
      summary: {
        payable: sum((r) => r.totals.payable),
        paid: sum((r) => r.totals.paid),
        due: sum((r) => r.totals.due),
        dueTillDate: sum((r) => r.totals.dueTillDate),
        defaulters: rows.filter((r) => r.totals.dueTillDate > 0).length,
      },
    };
  }

  /**
   * Fee due slips (old school format): one Hindi notice per student with pending fees,
   * 3 per A4 page. Given before a test/exam so parents clear dues to get the admit card.
   */
  async dueSlipsPdf(q: DueSlipQueryDto, scope: RequestScope) {
    if (!q.classId && !q.enrollmentIds?.length) throw new BadRequestException('Choose a class or students');
    const exam = q.examId ? await this.exams.findOne({ where: { id: q.examId, sessionId: scope.sessionId } }) : null;
    if (q.examId && !exam) throw new BadRequestException('Exam not found in this session');
    const rows = await this.ledger.bulk({
      sessionId: scope.sessionId,
      mediumId: q.mediumId ?? scope.mediumId,
      classId: q.enrollmentIds?.length ? undefined : q.classId,
      sectionId: q.enrollmentIds?.length ? undefined : q.sectionId,
      enrollmentIds: q.enrollmentIds,
    });
    const amountOf = (r: (typeof rows)[number]) => (q.basis === 'total' ? r.totals.due : r.totals.dueTillDate);
    const due = rows.filter((r) => amountOf(r) > 0);
    if (!due.length) throw new BadRequestException('No student in this selection has pending fees');

    const [school, print] = await Promise.all([this.settings.get('school'), this.settings.get('print')]);
    const PHRASE: Record<string, string> = { T1: 'प्रथम टेस्ट', T2: 'द्वितीय टेस्ट', T3: 'तृतीय टेस्ट', HY: 'अर्धवार्षिक परीक्षा', AN: 'वार्षिक परीक्षा' };
    const examPhrase = !exam ? '' : (exam.reportColumn && PHRASE[exam.reportColumn]) || `${exam.name} परीक्षा`;
    return this.pdf.render(
      dueSlipsHtml({
        logo: (school.logoPath && this.pdf.upload(school.logoPath, true)) || this.pdf.dataUri(join(process.cwd(), 'assets', 'default-logo.jpg'), true),
        print,
        examPhrase,
        examDate: dmy(q.examDate ?? exam?.startDate),
        lastDate: dmy(q.lastDate),
        slips: due.map((r) => ({
          name: r.student?.name ?? '',
          female: r.student?.gender === 'female',
          father: r.student?.fatherName ?? '',
          className: r.schoolClass?.name ?? '',
          amount: amountOf(r),
        })),
      }),
    );
  }

  /** Dashboard numbers */
  async summary(scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId, status: 'paid' };
    if (scope.mediumId) Object.assign(where, { mediumId: scope.mediumId });
    const today = new Date().toISOString().slice(0, 10);
    const sumNet = (w: WhereOptions) => this.payments.sum('netAmount', { where: w }).then((v) => toMoney(v));
    const [todayTotal, sessionTotal, dues] = await Promise.all([
      sumNet({ ...where, paymentDate: today }),
      sumNet(where),
      this.ledger.bulk({ sessionId: scope.sessionId, mediumId: scope.mediumId }),
    ]);
    return {
      today: todayTotal,
      session: sessionTotal,
      dueTillDate: toMoney(dues.reduce((n, d) => n + d.totals.dueTillDate, 0)),
      defaulters: dues.filter((d) => d.totals.dueTillDate > 0).length,
    };
  }

  /** Receipt PDF: school copy + student copy side by side, in the old receipt's layout */
  async receiptPdf(id: number, scope: RequestScope, opts: { single?: boolean } = {}) {
    const p = await this.findOne(id, scope);
    const [school, print, session, ledger] = await Promise.all([
      this.settings.get('school'),
      this.settings.get('print'),
      this.sessions.findByPk(scope.sessionId),
      this.ledger.forEnrollment(p.enrollmentId, scope.sessionId),
    ]);

    // One line per fee head (installments merged), as on the old receipt
    const rows = new Map<string, { head: string; amount: number; order: number }>();
    for (const it of p.items ?? []) {
      const head = it.feeHead?.name ?? 'Transport Fee';
      const r = rows.get(head) ?? { head, amount: 0, order: it.feeHead?.sortOrder ?? 999 };
      r.amount = toMoney(r.amount + toMoney(it.amount));
      rows.set(head, r);
    }
    const c = p.enrollment?.schoolClass?.name ?? '';
    const sec = p.enrollment?.section?.name ?? '';
    const next = ledger.installments.find((i) => i.totals.due > 0);
    const logo = (school.logoPath && this.pdf.upload(school.logoPath, true)) || this.pdf.dataUri(join(process.cwd(), 'assets', 'default-logo.jpg'), true);

    return this.pdf.render(
      receiptHtml({
        logo,
        print,
        receiptNo: p.receiptNo,
        date: dmy(p.paymentDate),
        studentName: p.student?.name ?? '',
        fatherName: p.student?.fatherName ?? '',
        address: [p.student?.address, p.student?.city].filter(Boolean).join(', '),
        className: !sec ? c : /^\d+$/.test(c) ? `${c}${sec}` : `${c} ${sec}`,
        batch: session?.name ?? '',
        lines: [...rows.values()].sort((x, y) => x.order - y.order),
        discount: toMoney(p.discount),
        fine: toMoney(p.fine),
        total: toMoney(p.netAmount),
        inWords: amountInWords(toMoney(p.netAmount)),
        mode: p.mode === 'cash' ? 'Cash' : p.mode.toUpperCase(),
        receivedBy: p.collector?.name ?? '',
        totalPayable: ledger.totals.payable,
        dueAmount: ledger.totals.due,
        nextDueDate: next ? dMonY(next.dueDate) : null,
        cancelled: p.status === 'cancelled',
        single: opts.single,
      }),
      { landscape: !opts.single, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } },
    );
  }

  private async canManage(actor: AuthUser) {
    if (actor.roleSlug === SUPER_ADMIN_ROLE) return true;
    return (await this.rbac.getPermissionKeys(actor.roleId)).has('fees.manage');
  }

  /** e.g. R26-00042 — per session, race-safe */
  private async nextReceiptNo(sessionId: number, t: Parameters<SequenceService['next']>[1]) {
    const [{ receiptPrefix }, session] = await Promise.all([this.settings.get('fees'), this.sessions.findByPk(sessionId, { transaction: t })]);
    const yy = (session?.startDate ?? '').slice(2, 4);
    const n = await this.sequences.next(`receipt:${sessionId}`, t);
    return `${receiptPrefix}${yy}-${String(n).padStart(5, '0')}`;
  }
}
