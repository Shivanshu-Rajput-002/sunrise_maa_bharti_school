import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import type { AuditQueryDto } from '../dto/role.dto';

export interface AuditEntry {
  userId?: number | null;
  sessionId?: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog) private readonly logs: typeof AuditLog) {}

  /** Fire-and-forget: an audit failure must never break the business action */
  log(entry: AuditEntry) {
    this.logs
      .create({ ...entry, entityId: entry.entityId != null ? String(entry.entityId) : null })
      .catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));
  }

  /** Activity list for the "User Activity" page, newest first */
  async list(q: AuditQueryDto) {
    const where: WhereOptions = {};
    if (q.userId) Object.assign(where, { userId: q.userId });
    if (q.entity) Object.assign(where, { entity: q.entity });
    if (q.action) Object.assign(where, { action: q.action });
    if (q.from || q.to) Object.assign(where, { createdAt: { ...(q.from ? { [Op.gte]: `${q.from} 00:00:00` } : {}), ...(q.to ? { [Op.lte]: `${q.to} 23:59:59` } : {}) } });
    const page = q.page ?? 1;
    const limit = q.limit ?? 30;
    const { rows, count } = await this.logs.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'username'], paranoid: false, required: false }],
      order: [['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { items: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
  }

  /** Distinct entity/action pairs for the page filters */
  async kinds() {
    const rows = (await this.logs.findAll({ attributes: ['entity', 'action'], group: ['entity', 'action'], raw: true })) as unknown as { entity: string; action: string }[];
    return rows;
  }
}
