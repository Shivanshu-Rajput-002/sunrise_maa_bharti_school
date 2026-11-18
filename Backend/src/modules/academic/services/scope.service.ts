import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AcademicSession } from '../entities/academic-session.entity';
import { Medium } from '../entities/medium.entity';

const TTL_MS = 60_000;

/**
 * Caches active session / medium ids so the per-request scope check
 * does not hit the database. Invalidated whenever sessions or mediums change.
 */
@Injectable()
export class ScopeService {
  private sessions?: { ids: Set<number>; at: number };
  private mediums?: { ids: Set<number>; at: number };

  constructor(
    @InjectModel(AcademicSession) private readonly sessionModel: typeof AcademicSession,
    @InjectModel(Medium) private readonly mediumModel: typeof Medium,
  ) {}

  async isValidSession(id: number): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) return false;
    if (!this.sessions || Date.now() - this.sessions.at > TTL_MS) {
      const rows = await this.sessionModel.findAll({ where: { isActive: true }, attributes: ['id'] });
      this.sessions = { ids: new Set(rows.map((r) => r.id)), at: Date.now() };
    }
    return this.sessions.ids.has(id);
  }

  async isValidMedium(id: number): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) return false;
    if (!this.mediums || Date.now() - this.mediums.at > TTL_MS) {
      const rows = await this.mediumModel.findAll({ where: { isActive: true }, attributes: ['id'] });
      this.mediums = { ids: new Set(rows.map((r) => r.id)), at: Date.now() };
    }
    return this.mediums.ids.has(id);
  }

  invalidate() {
    this.sessions = undefined;
    this.mediums = undefined;
  }
}
