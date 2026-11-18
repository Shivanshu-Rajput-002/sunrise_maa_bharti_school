import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { paginate } from '../../../common/utils/paginate';
import { AuditLog } from '../entities/audit-log.entity';

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

  list(query: PaginationQueryDto) {
    return paginate(this.logs, query, {}, ['id', 'createdAt', 'entity', 'action']);
  }
}
