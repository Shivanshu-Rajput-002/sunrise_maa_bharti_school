import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { PortalService } from '../services/portal.service';

const sendPdf = (res: Response, pdf: Buffer, name: string) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'no-store' });
  res.end(pdf);
};

@Permissions('portal.view')
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('children')
  children(@CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.children(u, s);
  }

  @Get('notices')
  notices(@CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.noticesFor(u, s);
  }

  @Get('buses')
  buses(@CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.buses(u, s);
  }

  @Get('children/:id/fees')
  fees(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.fees(id, u, s);
  }

  @Get('children/:id/receipts/:paymentId/pdf')
  async receipt(@Param('id', ParseIntPipe) id: number, @Param('paymentId', ParseIntPipe) pid: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.portal.receiptPdf(id, pid, u, s), `receipt-${pid}.pdf`);
  }

  @Get('children/:id/attendance')
  attendance(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.attendanceSummary(id, u, s);
  }

  @Get('children/:id/results')
  results(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.results(id, u, s);
  }

  @Get('children/:id/report-card/pdf')
  async reportCard(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.portal.reportCardPdf(id, u, s), `report-card.pdf`);
  }

  @Get('children/:id/exams')
  exams(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope) {
    return this.portal.examSchedule(id, u, s);
  }

  @Get('children/:id/admit-card/:examId/pdf')
  async admitCard(@Param('id', ParseIntPipe) id: number, @Param('examId', ParseIntPipe) examId: number, @CurrentUser() u: AuthUser, @Scope() s: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.portal.admitCardPdf(id, examId, u, s), `admit-card.pdf`);
  }
}
