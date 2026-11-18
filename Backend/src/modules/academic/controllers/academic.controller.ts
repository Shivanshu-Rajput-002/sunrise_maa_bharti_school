import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, SkipScope } from '../../../common/decorators';
import type { AuthUser } from '../../../common/interfaces/request-context';
import {
  CreateClassDto,
  CreateSectionDto,
  CreateSessionDto,
  CreateSubjectDto,
  UpdateClassDto,
  UpdateSectionDto,
  UpdateSessionDto,
  UpdateSubjectDto,
} from '../dto/academic.dto';
import { ClassesService } from '../services/classes.service';
import { SessionsService } from '../services/sessions.service';

/** Academic master data is global (not session-scoped), so scope resolution is skipped */
@SkipScope()
@Controller('academic')
export class AcademicController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly classes: ClassesService,
  ) {}

  // ---------- Sessions (list is open to every logged-in user: needed by the switcher) ----------
  @Get('sessions')
  listSessions() {
    return this.sessions.list(true);
  }

  @Get('sessions/all')
  @Permissions('academic.view')
  listAllSessions() {
    return this.sessions.list(false);
  }

  @Post('sessions')
  @Permissions('academic.create')
  createSession(@Body() dto: CreateSessionDto, @CurrentUser() u: AuthUser) {
    return this.sessions.create(dto, u);
  }

  @Patch('sessions/:id')
  @Permissions('academic.update')
  updateSession(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSessionDto, @CurrentUser() u: AuthUser) {
    return this.sessions.update(id, dto, u);
  }

  @Post('sessions/:id/set-current')
  @Permissions('academic.update')
  setCurrent(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.sessions.setCurrent(id, u);
  }

  // ---------- Mediums ----------
  @Get('mediums')
  listMediums() {
    return this.classes.listMediums();
  }

  // ---------- Classes ----------
  @Get('classes')
  listClasses(@Query('all', new ParseBoolPipe({ optional: true })) all?: boolean) {
    return this.classes.listClasses(all);
  }

  @Post('classes')
  @Permissions('academic.create')
  createClass(@Body() dto: CreateClassDto, @CurrentUser() u: AuthUser) {
    return this.classes.createClass(dto, u);
  }

  @Patch('classes/:id')
  @Permissions('academic.update')
  updateClass(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClassDto, @CurrentUser() u: AuthUser) {
    return this.classes.updateClass(id, dto, u);
  }

  @Delete('classes/:id')
  @Permissions('academic.delete')
  removeClass(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.classes.removeClass(id, u);
  }

  // ---------- Sections ----------
  @Post('sections')
  @Permissions('academic.create')
  createSection(@Body() dto: CreateSectionDto, @CurrentUser() u: AuthUser) {
    return this.classes.createSection(dto, u);
  }

  @Patch('sections/:id')
  @Permissions('academic.update')
  updateSection(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto, @CurrentUser() u: AuthUser) {
    return this.classes.updateSection(id, dto, u);
  }

  @Delete('sections/:id')
  @Permissions('academic.delete')
  removeSection(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.classes.removeSection(id, u);
  }

  // ---------- Subjects ----------
  @Get('subjects')
  listSubjects(@Query('all', new ParseBoolPipe({ optional: true })) all?: boolean) {
    return this.classes.listSubjects(all);
  }

  @Post('subjects')
  @Permissions('academic.create')
  createSubject(@Body() dto: CreateSubjectDto, @CurrentUser() u: AuthUser) {
    return this.classes.createSubject(dto, u);
  }

  @Patch('subjects/:id')
  @Permissions('academic.update')
  updateSubject(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectDto, @CurrentUser() u: AuthUser) {
    return this.classes.updateSubject(id, dto, u);
  }

  @Delete('subjects/:id')
  @Permissions('academic.delete')
  removeSubject(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.classes.removeSubject(id, u);
  }
}
