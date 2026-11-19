import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ForeignKeyConstraintError, Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { toMoney } from '../../../common/utils/money';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import {
  CashbookQueryDto,
  CreateCashbookEntryDto,
  CreateCashbookHeadDto,
  UpdateCashbookEntryDto,
  UpdateCashbookHeadDto,
} from '../dto/fee.dto';
import { CashbookEntry, CashbookHead, FeePayment } from '../entities/fee.entities';

@Injectable()
export class CashbookService {
  constructor(
    @InjectModel(CashbookHead) private readonly heads: typeof CashbookHead,
    @InjectModel(CashbookEntry) private readonly entries: typeof CashbookEntry,
    @InjectModel(FeePayment) private readonly payments: typeof FeePayment,
    private readonly audit: AuditService,
  ) {}

  listHeads() {
    return this.heads.findAll({ order: [['type', 'ASC'], ['name', 'ASC']] });
  }

  async createHead(dto: CreateCashbookHeadDto, actor: AuthUser) {
    try {
      const h = await this.heads.create({ ...dto });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'cashbook_head', entityId: h.id });
      return h;
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Head already exists');
      throw e;
    }
  }

  async updateHead(id: number, dto: UpdateCashbookHeadDto, actor: AuthUser) {
    const h = await this.heads.findByPk(id);
    if (!h) throw new NotFoundException('Head not found');
    if (dto.type && dto.type !== h.type && (await this.entries.count({ where: { headId: id } }))) {
      throw new BadRequestException('Head already has entries — its type cannot change');
    }
    try {
      await h.update(dto);
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Head already exists');
      throw e;
    }
    this.audit.log({ userId: actor.id, action: 'update', entity: 'cashbook_head', entityId: id });
    return h;
  }

  async removeHead(id: number, actor: AuthUser) {
    const h = await this.heads.findByPk(id);
    if (!h) throw new NotFoundException('Head not found');
    try {
      await h.destroy();
    } catch (e) {
      if (e instanceof ForeignKeyConstraintError) throw new BadRequestException('Head has entries — mark it inactive instead');
      throw e;
    }
    this.audit.log({ userId: actor.id, action: 'delete', entity: 'cashbook_head', entityId: id });
    return { id };
  }

  /** Entries + income / expense / balance for the range. Fee collections are added as income. */
  async list(q: CashbookQueryDto, scope: RequestScope) {
    const range = q.from || q.to ? { ...(q.from ? { [Op.gte]: q.from } : {}), ...(q.to ? { [Op.lte]: q.to } : {}) } : undefined;
    const where: WhereOptions = { sessionId: scope.sessionId };
    if (range) Object.assign(where, { entryDate: range });
    if (q.type) Object.assign(where, { type: q.type });
    if (q.headId) Object.assign(where, { headId: q.headId });
    if (q.search) Object.assign(where, { [Op.or]: [{ party: { [Op.like]: `%${q.search}%` } }, { remarks: { [Op.like]: `%${q.search}%` } }] });

    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    // Cancelled entries stay in the list (struck through) but never count in totals
    const baseWhere: WhereOptions = { sessionId: scope.sessionId, status: 'active', ...(range ? { entryDate: range } : {}) };
    const feeWhere: WhereOptions = { sessionId: scope.sessionId, status: 'paid', ...(range ? { paymentDate: range } : {}) };

    const [{ rows, count }, income, expense, fees] = await Promise.all([
      this.entries.findAndCountAll({
        where,
        include: [
          { model: CashbookHead, attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'name'] },
        ],
        order: [['entryDate', 'DESC'], ['id', 'DESC']],
        limit,
        offset: (page - 1) * limit,
      }),
      this.entries.sum('amount', { where: { ...baseWhere, type: 'income' } }),
      this.entries.sum('amount', { where: { ...baseWhere, type: 'expense' } }),
      this.payments.sum('netAmount', { where: feeWhere }),
    ]);

    const totalIncome = toMoney(toMoney(income) + toMoney(fees));
    return {
      items: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      summary: {
        feeCollection: toMoney(fees),
        otherIncome: toMoney(income),
        income: totalIncome,
        expense: toMoney(expense),
        balance: toMoney(totalIncome - toMoney(expense)),
      },
    };
  }

  async create(dto: CreateCashbookEntryDto, scope: RequestScope, actor: AuthUser) {
    const head = await this.heads.findByPk(dto.headId);
    if (!head || !head.isActive) throw new BadRequestException('Head not found or inactive');
    const e = await this.entries.create({ ...dto, amount: toMoney(dto.amount), type: head.type, sessionId: scope.sessionId, createdBy: actor.id });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'cashbook_entry', entityId: e.id, meta: { amount: e.amount, type: e.type } });
    return e;
  }

  async update(id: number, dto: UpdateCashbookEntryDto, scope: RequestScope, actor: AuthUser) {
    const e = await this.entries.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!e) throw new NotFoundException('Entry not found in this session');
    if (e.status === 'cancelled') throw new BadRequestException('This entry is cancelled and cannot be changed.');
    const patch: Record<string, unknown> = { ...dto };
    if (dto.headId) {
      const head = await this.heads.findByPk(dto.headId);
      if (!head) throw new BadRequestException('Head not found');
      patch.type = head.type;
    }
    if (dto.amount !== undefined) patch.amount = toMoney(dto.amount);
    await e.update(patch);
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'cashbook_entry', entityId: id });
    return e;
  }

  /** Cancel (not delete): the entry stays on record with who / when / why */
  async cancel(id: number, reason: string, scope: RequestScope, actor: AuthUser) {
    const e = await this.entries.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!e) throw new NotFoundException('Entry not found in this session');
    if (e.status === 'cancelled') throw new BadRequestException('This entry is already cancelled.');
    await e.update({ status: 'cancelled', cancelReason: reason.trim(), cancelledBy: actor.id, cancelledAt: new Date() });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'cancel', entity: 'cashbook_entry', entityId: id, meta: { amount: e.amount, reason: reason.trim() } });
    return e;
  }
}
