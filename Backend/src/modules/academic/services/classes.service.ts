import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { AuthUser } from '../../../common/interfaces/request-context';
import { AuditService } from '../../admin/services/audit.service';
import {
  CreateClassDto,
  CreateSectionDto,
  CreateSubjectDto,
  UpdateClassDto,
  UpdateSectionDto,
  UpdateSubjectDto,
} from '../dto/academic.dto';
import { Medium } from '../entities/medium.entity';
import { SchoolClass } from '../entities/school-class.entity';
import { Section } from '../entities/section.entity';
import { Subject } from '../entities/subject.entity';

/** Classes, sections, subjects and mediums — small master tables */
@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(SchoolClass) private readonly classes: typeof SchoolClass,
    @InjectModel(Section) private readonly sections: typeof Section,
    @InjectModel(Subject) private readonly subjects: typeof Subject,
    @InjectModel(Medium) private readonly mediums: typeof Medium,
    private readonly audit: AuditService,
  ) {}

  // ---------- Mediums ----------
  listMediums() {
    return this.mediums.findAll({ where: { isActive: true }, attributes: ['id', 'code', 'name'], order: [['id', 'ASC']] });
  }

  // ---------- Classes ----------
  listClasses(includeInactive = false) {
    return this.classes.findAll({
      where: includeInactive ? {} : { isActive: true },
      include: [
        { model: Section, attributes: ['id', 'name', 'isActive'] },
        { model: SchoolClass, as: 'nextClass', attributes: ['id', 'name'] },
      ],
      order: [
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
        [{ model: Section, as: 'sections' }, 'name', 'ASC'],
      ],
    });
  }

  async createClass(dto: CreateClassDto, actor: AuthUser) {
    return this.guard(async () => {
      const c = await this.classes.create({ ...dto });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'class', entityId: c.id });
      return c;
    });
  }

  async updateClass(id: number, dto: UpdateClassDto, actor: AuthUser) {
    const c = await this.find(this.classes, id, 'Class');
    if (dto.nextClassId === id) throw new BadRequestException('A class cannot promote into itself');
    return this.guard(async () => {
      await c.update(dto);
      this.audit.log({ userId: actor.id, action: 'update', entity: 'class', entityId: id });
      return c;
    });
  }

  async removeClass(id: number, actor: AuthUser) {
    const c = await this.find(this.classes, id, 'Class');
    return this.guard(async () => {
      await c.destroy();
      this.audit.log({ userId: actor.id, action: 'delete', entity: 'class', entityId: id });
      return { id };
    });
  }

  // ---------- Sections ----------
  async createSection(dto: CreateSectionDto, actor: AuthUser) {
    await this.find(this.classes, dto.classId, 'Class');
    return this.guard(async () => {
      const s = await this.sections.create({ ...dto, name: dto.name.toUpperCase() });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'section', entityId: s.id });
      return s;
    });
  }

  async updateSection(id: number, dto: UpdateSectionDto, actor: AuthUser) {
    const s = await this.find(this.sections, id, 'Section');
    return this.guard(async () => {
      await s.update({ ...dto, ...(dto.name ? { name: dto.name.toUpperCase() } : {}) });
      this.audit.log({ userId: actor.id, action: 'update', entity: 'section', entityId: id });
      return s;
    });
  }

  async removeSection(id: number, actor: AuthUser) {
    const s = await this.find(this.sections, id, 'Section');
    return this.guard(async () => {
      await s.destroy();
      this.audit.log({ userId: actor.id, action: 'delete', entity: 'section', entityId: id });
      return { id };
    });
  }

  // ---------- Subjects ----------
  listSubjects(includeInactive = false) {
    return this.subjects.findAll({ where: includeInactive ? {} : { isActive: true }, order: [['name', 'ASC']] });
  }

  async createSubject(dto: CreateSubjectDto, actor: AuthUser) {
    return this.guard(async () => {
      const s = await this.subjects.create({ ...dto });
      this.audit.log({ userId: actor.id, action: 'create', entity: 'subject', entityId: s.id });
      return s;
    });
  }

  async updateSubject(id: number, dto: UpdateSubjectDto, actor: AuthUser) {
    const s = await this.find(this.subjects, id, 'Subject');
    return this.guard(async () => {
      await s.update(dto);
      this.audit.log({ userId: actor.id, action: 'update', entity: 'subject', entityId: id });
      return s;
    });
  }

  async removeSubject(id: number, actor: AuthUser) {
    const s = await this.find(this.subjects, id, 'Subject');
    return this.guard(async () => {
      await s.destroy();
      this.audit.log({ userId: actor.id, action: 'delete', entity: 'subject', entityId: id });
      return { id };
    });
  }

  // ---------- helpers ----------
  private async find<T extends { findByPk: (id: number) => Promise<any> }>(model: T, id: number, label: string) {
    const row = await model.findByPk(id);
    if (!row) throw new NotFoundException(`${label} not found`);
    return row;
  }

  /** Map DB constraint errors to clean HTTP errors */
  private async guard<R>(fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('A record with this name already exists');
      if (e instanceof ForeignKeyConstraintError) throw new BadRequestException('This record is linked to other data, so it cannot be changed or removed');
      throw e;
    }
  }
}
