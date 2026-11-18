import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { AuditService } from '../../admin/services/audit.service';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { CreateBusDto, CreateRouteDto, UpdateBusDto, UpdateRouteDto } from '../dto/transport.dto';
import { Bus, TransportRoute } from '../entities/transport.entities';

@Injectable()
export class TransportService {
  constructor(
    @InjectModel(TransportRoute) private readonly routes: typeof TransportRoute,
    @InjectModel(Bus) private readonly buses: typeof Bus,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    private readonly audit: AuditService,
  ) {}

  /** Routes of the active session with how many students use each */
  async listRoutes(scope: RequestScope) {
    const routes = await this.routes.findAll({ where: { sessionId: scope.sessionId }, order: [['name', 'ASC']] });
    const counts = (await this.enrollments.count({
      where: { sessionId: scope.sessionId, status: 'studying' },
      group: ['transportRouteId'],
    })) as unknown as { transportRouteId: number | null; count: number }[];
    const map = new Map(counts.map((c) => [c.transportRouteId, Number(c.count)]));
    return routes.map((r) => ({ ...r.toJSON(), students: map.get(r.id) ?? 0 }));
  }

  async createRoute(dto: CreateRouteDto, scope: RequestScope, actor: AuthUser) {
    return this.guard(async () => {
      const r = await this.routes.create({ ...dto, sessionId: scope.sessionId });
      this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'create', entity: 'transport_route', entityId: r.id });
      return r;
    });
  }

  async updateRoute(id: number, dto: UpdateRouteDto, scope: RequestScope, actor: AuthUser) {
    const r = await this.routes.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!r) throw new NotFoundException('Route not found in this session');
    return this.guard(async () => {
      await r.update(dto);
      this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'update', entity: 'transport_route', entityId: id });
      return r;
    });
  }

  async removeRoute(id: number, scope: RequestScope, actor: AuthUser) {
    const r = await this.routes.findOne({ where: { id, sessionId: scope.sessionId } });
    if (!r) throw new NotFoundException('Route not found in this session');
    const used = await this.enrollments.count({ where: { transportRouteId: id } });
    if (used) throw new BadRequestException(`${used} students use this route — reassign them first or mark the route inactive`);
    await r.destroy();
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'delete', entity: 'transport_route', entityId: id });
    return { id };
  }

  /** Copy all routes (with fees) from another session — handy at session start */
  async copyRoutes(fromSessionId: number, scope: RequestScope, actor: AuthUser) {
    if (fromSessionId === scope.sessionId) throw new BadRequestException('Choose a different session to copy from');
    const src = await this.routes.findAll({ where: { sessionId: fromSessionId } });
    if (!src.length) throw new BadRequestException('That session has no routes');
    await this.routes.bulkCreate(
      src.map((r) => ({ sessionId: scope.sessionId, name: r.name, annualFee: r.annualFee, isActive: r.isActive })),
      { ignoreDuplicates: true },
    );
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'copy', entity: 'transport_route', meta: { fromSessionId } });
    return this.listRoutes(scope);
  }

  listBuses() {
    return this.buses.findAll({ order: [['busNo', 'ASC']] });
  }

  async createBus(dto: CreateBusDto, actor: AuthUser) {
    return this.guard(async () => {
      const b = await this.buses.create({ ...dto, busNo: dto.busNo.toUpperCase() });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'bus', entityId: b.id });
      return b;
    });
  }

  async updateBus(id: number, dto: UpdateBusDto, actor: AuthUser) {
    const b = await this.buses.findByPk(id);
    if (!b) throw new NotFoundException('Bus not found');
    return this.guard(async () => {
      await b.update({ ...dto, ...(dto.busNo ? { busNo: dto.busNo.toUpperCase() } : {}) });
      this.audit.log({ userId: actor.id, action: 'update', entity: 'bus', entityId: id });
      return b;
    });
  }

  async removeBus(id: number, actor: AuthUser) {
    const b = await this.buses.findByPk(id);
    if (!b) throw new NotFoundException('Bus not found');
    await b.destroy();
    this.audit.log({ userId: actor.id, action: 'delete', entity: 'bus', entityId: id });
    return { id };
  }

  private async guard<R>(fn: () => Promise<R>) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('Already exists');
      if (e instanceof ForeignKeyConstraintError) throw new BadRequestException('Record is in use');
      throw e;
    }
  }
}
