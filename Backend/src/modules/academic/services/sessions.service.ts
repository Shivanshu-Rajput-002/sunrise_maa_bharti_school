import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AuthUser } from '../../../common/interfaces/request-context';
import { AuditService } from '../../admin/services/audit.service';
import { CreateSessionDto, UpdateSessionDto } from '../dto/academic.dto';
import { AcademicSession } from '../entities/academic-session.entity';
import { ScopeService } from './scope.service';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    private readonly sequelize: Sequelize,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Newest first — used by login dropdown and dashboard switcher */
  list(activeOnly = false) {
    return this.sessions.findAll({
      where: activeOnly ? { isActive: true } : {},
      attributes: ['id', 'name', 'startDate', 'endDate', 'isCurrent', 'isActive'],
      order: [['startDate', 'DESC']],
    });
  }

  async current() {
    return (
      (await this.sessions.findOne({ where: { isCurrent: true, isActive: true } })) ??
      (await this.sessions.findOne({ where: { isActive: true }, order: [['startDate', 'DESC']] }))
    );
  }

  async create(dto: CreateSessionDto, actor: AuthUser) {
    this.assertDates(dto.startDate, dto.endDate);
    try {
      const s = await this.sessions.create({ ...dto });
      this.scope.invalidate();
      this.audit.log({ userId: actor.id, action: 'create', entity: 'session', entityId: s.id });
      return s;
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Session already exists');
      throw e;
    }
  }

  async update(id: number, dto: UpdateSessionDto, actor: AuthUser) {
    const s = await this.get(id);
    this.assertDates(dto.startDate ?? s.startDate, dto.endDate ?? s.endDate);
    if (dto.isActive === false && s.isCurrent) throw new BadRequestException('Current session cannot be deactivated');
    await s.update(dto);
    this.scope.invalidate();
    this.audit.log({ userId: actor.id, action: 'update', entity: 'session', entityId: id });
    return s;
  }

  /** Exactly one current session — done atomically */
  async setCurrent(id: number, actor: AuthUser) {
    const s = await this.get(id);
    if (!s.isActive) throw new BadRequestException('Activate the session first');
    await this.sequelize.transaction(async (transaction) => {
      await this.sessions.update({ isCurrent: false }, { where: { isCurrent: true }, transaction });
      await s.update({ isCurrent: true }, { transaction });
    });
    this.audit.log({ userId: actor.id, action: 'set_current', entity: 'session', entityId: id });
    return s;
  }

  private async get(id: number) {
    const s = await this.sessions.findByPk(id);
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  private assertDates(start: string, end: string) {
    if (new Date(start) >= new Date(end)) throw new BadRequestException('endDate must be after startDate');
  }
}
