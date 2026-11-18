import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { ClassQueryDto, CreateExamDto, MarksheetExtrasDto, MarksQueryDto, SaveMarksDto, SaveScheduleDto, UpdateExamDto } from '../dto/exam.dto';
import { ExamPrintService } from '../services/exam-print.service';
import { ExamsService } from '../services/exams.service';

const sendPdf = (res: Response, pdf: Buffer, name: string) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'no-store' });
  res.end(pdf);
};

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly print: ExamPrintService,
  ) {}

  /** SUPW / Art / Jeevan Kaushal marks, co-scholastic grades, health, remark for one student */
  @Get('marksheet-extras/:enrollmentId')
  @Permissions('exams.view')
  extras(@Param('enrollmentId', ParseIntPipe) id: number, @Scope() s: RequestScope) {
    return this.print.getExtras(id, s.sessionId);
  }

  @Put('marksheet-extras/:enrollmentId')
  @Permissions('exams.marks')
  saveExtras(@Param('enrollmentId', ParseIntPipe) id: number, @Body() dto: MarksheetExtrasDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.print.saveExtras(id, s.sessionId, { ...dto }, u.id);
  }

  @Get()
  @Permissions('exams.view')
  list(@Scope() s: RequestScope) {
    return this.exams.list(s);
  }

  @Post()
  @Permissions('exams.manage')
  create(@Body() dto: CreateExamDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.exams.create(dto, s, u);
  }

  @Get('marks')
  @Permissions('exams.view')
  marks(@Query() q: MarksQueryDto, @Scope() s: RequestScope) {
    return this.exams.getMarks(q, s);
  }

  @Put('marks')
  @Permissions('exams.marks')
  saveMarks(@Body() dto: SaveMarksDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.exams.saveMarks(dto, s, u);
  }

  @Get('report-card/:enrollmentId')
  @Permissions('exams.view')
  reportCard(@Param('enrollmentId', ParseIntPipe) id: number, @Scope() s: RequestScope) {
    return this.exams.reportCard(id, s.sessionId);
  }

  @Get('report-card/:enrollmentId/pdf')
  @Permissions('exams.view')
  async reportCardPdf(@Param('enrollmentId', ParseIntPipe) id: number, @Scope() s: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.exams.reportCardPdf([id], s.sessionId), `report-card-${id}.pdf`);
  }

  @Get('report-cards/pdf')
  @Permissions('exams.view')
  async classReportCards(@Query() q: ClassQueryDto, @Scope() s: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.exams.classReportCardsPdf(q, s), `report-cards-class-${q.classId}.pdf`);
  }

  @Patch(':id')
  @Permissions('exams.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExamDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.exams.update(id, dto, s, u);
  }

  @Delete(':id')
  @Permissions('exams.manage')
  remove(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.exams.remove(id, s, u);
  }

  @Get(':id/schedule')
  @Permissions('exams.view')
  schedule(@Param('id', ParseIntPipe) id: number, @Query('classId', ParseIntPipe) classId: number, @Scope() s: RequestScope) {
    return this.exams.getSchedule(id, classId, s);
  }

  @Put(':id/schedule')
  @Permissions('exams.manage')
  saveSchedule(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveScheduleDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.exams.saveSchedule(id, dto, s, u);
  }

  @Get(':id/result')
  @Permissions('exams.view')
  result(@Param('id', ParseIntPipe) id: number, @Query() q: ClassQueryDto, @Scope() s: RequestScope) {
    return this.exams.classResult(id, q, s);
  }

  @Get(':id/admit-cards/pdf')
  @Permissions('exams.view')
  async admitCards(@Param('id', ParseIntPipe) id: number, @Query() q: ClassQueryDto, @Scope() s: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.exams.admitCardsPdf(id, q, s), `admit-cards-${id}.pdf`);
  }
}
