import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { toMoney } from '../../../common/utils/money';
import { AuditService } from '../../admin/services/audit.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import {
  ConcessionDto,
  CopyStructureDto,
  CreateFeeHeadDto,
  CreateInstallmentDto,
  SaveStructureDto,
  StructureQueryDto,
  UpdateFeeHeadDto,
  UpdateInstallmentDto,
} from '../dto/fee.dto';
import { FeeConcession, FeeHead, FeeInstallment, FeePaymentItem, FeeStructure } from '../entities/fee.entities';

/** Fee heads, installments, class-wise structure and concessions */
@Injectable()
export class FeeSetupService {
  constructor(
    @InjectModel(FeeHead) private readonly heads: typeof FeeHead,
    @InjectModel(FeeInstallment) private readonly installments: typeof FeeInstallment,
    @InjectModel(FeeStructure) private readonly structures: typeof FeeStructure,
    @InjectModel(FeeConcession) private readonly concessions: typeof FeeConcession,
    @InjectModel(FeePaymentItem) private readonly paymentItems: typeof FeePaymentItem,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    private readonly sequelize: Sequelize,
    private readonly audit: AuditService,
  ) {}

  // ---------- heads (global) ----------
  listHeads(includeInactive = false) {
    return this.heads.findAll({ where: includeInactive ? {} : { isActive: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
  }

  createHead(dto: CreateFeeHeadDto, actor: AuthUser) {
    return this.guard(async () => {
      const h = await this.heads.create({ ...dto });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'fee_head', entityId: h.id });
      return h;
    });
  }

  async updateHead(id: number, dto: UpdateFeeHeadDto, actor: AuthUser) {
    const h = await this.heads.findByPk(id);
    if (!h) throw new NotFoundException('Fee head not found');
    return this.guard(async () => {
      await h.update(dto);
      this.audit.log({ userId: actor.id, action: 'update', entity: 'fee_head', entityId: id });
      return h;
    });
  }

  async removeHead(id: number, actor: AuthUser) {
    const h = await this.heads.findByPk(id);
    if (!h) throw new NotFoundException('Fee head not found');
    return this.guard(async () => {
      await h.destroy();
      this.audit.log({ userId: actor.id, action: 'delete', entity: 'fee_head', entityId: id });
      return { id };
    }, 'Fee head is used in a fee structure or receipt — mark it inactive instead');
  }

  // ---------- installments (per session) ----------
  listInstallments(scope: RequestScope) {
    return this.installments.findAll({ where: { sessionId: scope.sessionId }, order: [['sortOrder', 'ASC'], ['dueDate', 'ASC']] });
  }

  createInstallment(dto: CreateInstallmentDto, scope: RequestScope, actor: AuthUser) {
    return this.guard(async () => {
      const i = await this.installments.create({ ...dto, sessionId: scope.sessionId });
      this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'fee_installment', entityId: i.id });
      return i;
    });
  }

  async updateInstallment(id: number, dto: UpdateInstallmentDto, scope: RequestScope, actor: AuthUser) {
    const i = await this.installments.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!i) throw new NotFoundException('Installment not found in this session');
    return this.guard(async () => {
      await i.update(dto);
      this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'fee_installment', entityId: id });
      return i;
    });
  }

  async removeInstallment(id: number, scope: RequestScope, actor: AuthUser) {
    const i = await this.installments.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!i) throw new NotFoundException('Installment not found in this session');
    if (await this.paymentItems.count({ where: { installmentId: id } })) {
      throw new BadRequestException('Fees were already collected against this installment');
    }
    await i.destroy(); // structure rows cascade
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'delete', entity: 'fee_installment', entityId: id });
    return { id };
  }

  // ---------- structure ----------
  async getStructure(q: StructureQueryDto, scope: RequestScope) {
    const rows = await this.structures.findAll({
      where: { sessionId: scope.sessionId, classId: q.classId, mediumId: q.mediumId },
      attributes: ['installmentId', 'feeHeadId', 'amount'],
    });
    return rows.map((r) => ({ installmentId: r.installmentId, feeHeadId: r.feeHeadId, amount: toMoney(r.amount) }));
  }

  /** Replace the whole matrix for one class + medium in the active session */
  async saveStructure(dto: SaveStructureDto, scope: RequestScope, actor: AuthUser) {
    const instIds = new Set(
      (await this.installments.findAll({ where: { sessionId: scope.sessionId }, attributes: ['id'] })).map((i) => i.id),
    );
    if (dto.items.some((i) => !instIds.has(i.installmentId))) throw new BadRequestException('Installment does not belong to this session');

    const rows = dto.items
      .filter((i) => toMoney(i.amount) > 0)
      .map((i) => ({
        sessionId: scope.sessionId,
        mediumId: dto.mediumId,
        classId: dto.classId,
        installmentId: i.installmentId,
        feeHeadId: i.feeHeadId,
        amount: toMoney(i.amount),
      }));

    await this.guard(() =>
      this.sequelize.transaction(async (transaction) => {
        await this.structures.destroy({
          where: { sessionId: scope.sessionId, classId: dto.classId, mediumId: dto.mediumId },
          transaction,
        });
        if (rows.length) await this.structures.bulkCreate(rows, { transaction });
      }),
    );
    this.audit.log({
      userId: actor.id,
      sessionId: scope.sessionId,
      action: 'update',
      entity: 'fee_structure',
      meta: { classId: dto.classId, mediumId: dto.mediumId, lines: rows.length },
    });
    return this.getStructure(dto, scope);
  }

  async copyStructure(dto: CopyStructureDto, scope: RequestScope, actor: AuthUser) {
    const src = await this.getStructure(dto, scope);
    if (!src.length) throw new BadRequestException('Source class has no fee structure');
    for (const t of dto.targets) {
      if (t.classId === dto.classId && t.mediumId === dto.mediumId) continue;
      await this.saveStructure({ ...t, items: src }, scope, actor);
    }
    return { copiedTo: dto.targets.length };
  }

  // ---------- concession ----------
  async setConcession(enrollmentId: number, dto: ConcessionDto, scope: RequestScope, actor: AuthUser) {
    const enr = await this.enrollments.findOne({ where: { id: enrollmentId, sessionId: scope.sessionId } });
    if (!enr) throw new NotFoundException('This student is not enrolled in the selected session');
    if (dto.type === 'percent' && dto.value > 100) throw new BadRequestException('Percent cannot exceed 100');
    await this.concessions.upsert({ enrollmentId, type: dto.type, value: toMoney(dto.value), reason: dto.reason ?? null });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'fee_concession', entityId: enrollmentId, meta: { ...dto } });
    return this.concessions.findOne({ where: { enrollmentId } });
  }

  async removeConcession(enrollmentId: number, scope: RequestScope, actor: AuthUser) {
    await this.concessions.destroy({ where: { enrollmentId } });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'delete', entity: 'fee_concession', entityId: enrollmentId });
    return { enrollmentId };
  }

  private async guard<R>(fn: () => Promise<R>, fkMessage = 'Record is in use'): Promise<R> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('A record with this name already exists');
      if (e instanceof ForeignKeyConstraintError) throw new BadRequestException(fkMessage);
      throw e;
    }
  }
}
