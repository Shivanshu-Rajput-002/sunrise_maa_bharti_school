import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { paginate } from '../../../common/utils/paginate';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import { CreateNoticeDto, NoticeQueryDto, UpdateNoticeDto } from '../dto/notice.dto';
import { Notice } from '../entities/notice.entity';

const today = () => new Date().toISOString().slice(0, 10);
/** Visible today: started, and not yet expired */
const activeWhere = () => ({
  publishFrom: { [Op.lte]: today() },
  [Op.or]: [{ publishTo: null }, { publishTo: { [Op.gte]: today() } }],
});

@Injectable()
export class NoticesService {
  constructor(
    @InjectModel(Notice) private readonly notices: typeof Notice,
    private readonly audit: AuditService,
  ) {}

  list(q: NoticeQueryDto, scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId };
    if (q.audience) Object.assign(where, { audience: q.audience });
    if (q.activeOnly) Object.assign(where, activeWhere());
    if (q.search) Object.assign(where, { title: { [Op.like]: `%${q.search}%` } });
    return paginate(
      this.notices,
      q,
      { where, include: [{ model: SchoolClass, attributes: ['id', 'name'] }, { model: User, as: 'creator', attributes: ['id', 'name'] }] },
      ['publishFrom', 'title', 'id'],
      [['publishFrom', 'DESC'], ['id', 'DESC']],
    );
  }

  /** Notices a parent should see for the given classes */
  forParents(sessionId: number, classIds: number[]) {
    return this.notices.findAll({
      where: {
        sessionId,
        audience: ['all', 'parents'],
        ...activeWhere(),
        [Op.and]: [{ [Op.or]: [{ classId: null }, { classId: classIds.length ? classIds : [0] }] }],
      },
      include: [{ model: SchoolClass, attributes: ['id', 'name'] }],
      order: [['publishFrom', 'DESC']],
      limit: 50,
    });
  }

  /** Active notices for staff dashboards */
  forStaff(sessionId: number) {
    return this.notices.findAll({ where: { sessionId, audience: ['all', 'staff'], ...activeWhere() }, order: [['publishFrom', 'DESC']], limit: 10 });
  }

  async create(dto: CreateNoticeDto, scope: RequestScope, actor: AuthUser) {
    if (dto.publishTo && dto.publishTo < dto.publishFrom) throw new BadRequestException('End date must be after start date');
    const n = await this.notices.create({ ...dto, sessionId: scope.sessionId, createdBy: actor.id });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'notice', entityId: n.id });
    return n;
  }

  async update(id: number, dto: UpdateNoticeDto, scope: RequestScope, actor: AuthUser) {
    const n = await this.notices.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!n) throw new NotFoundException('Notice not found');
    const from = dto.publishFrom ?? n.publishFrom;
    const to = dto.publishTo !== undefined ? dto.publishTo : n.publishTo;
    if (to && to < from) throw new BadRequestException('End date must be after start date');
    await n.update(dto);
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'notice', entityId: id });
    return n;
  }

  async remove(id: number, scope: RequestScope, actor: AuthUser) {
    const count = await this.notices.destroy({ where: { id, sessionId: scope.sessionId } });
    if (!count) throw new NotFoundException('Notice not found');
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'delete', entity: 'notice', entityId: id });
    return { id };
  }
}
