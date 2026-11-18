import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import {
  DueSlipQueryDto,
  CancelPaymentDto,
  CollectFeeDto,
  ConcessionDto,
  CopyStructureDto,
  CreateFeeHeadDto,
  CreateInstallmentDto,
  DuesQueryDto,
  PaymentQueryDto,
  SaveStructureDto,
  StructureQueryDto,
  UpdateFeeHeadDto,
  UpdateInstallmentDto,
} from '../dto/fee.dto';
import { FeeCollectionService } from '../services/fee-collection.service';
import { FeeLedgerService } from '../services/fee-ledger.service';
import { FeeSetupService } from '../services/fee-setup.service';

@Controller('fees')
export class FeesController {
  constructor(
    private readonly setup: FeeSetupService,
    private readonly ledger: FeeLedgerService,
    private readonly collection: FeeCollectionService,
  ) {}

  // ---------- heads ----------
  @Get('heads')
  @Permissions('fees.view')
  heads(@Query('all', new ParseBoolPipe({ optional: true })) all?: boolean) {
    return this.setup.listHeads(all);
  }

  @Post('heads')
  @Permissions('fees.manage')
  createHead(@Body() dto: CreateFeeHeadDto, @CurrentUser() u: AuthUser) {
    return this.setup.createHead(dto, u);
  }

  @Patch('heads/:id')
  @Permissions('fees.manage')
  updateHead(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFeeHeadDto, @CurrentUser() u: AuthUser) {
    return this.setup.updateHead(id, dto, u);
  }

  @Delete('heads/:id')
  @Permissions('fees.manage')
  removeHead(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.setup.removeHead(id, u);
  }

  // ---------- installments ----------
  @Get('installments')
  @Permissions('fees.view')
  installments(@Scope() s: RequestScope) {
    return this.setup.listInstallments(s);
  }

  @Post('installments')
  @Permissions('fees.manage')
  createInstallment(@Body() dto: CreateInstallmentDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.createInstallment(dto, s, u);
  }

  @Patch('installments/:id')
  @Permissions('fees.manage')
  updateInstallment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInstallmentDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.updateInstallment(id, dto, s, u);
  }

  @Delete('installments/:id')
  @Permissions('fees.manage')
  removeInstallment(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.removeInstallment(id, s, u);
  }

  // ---------- structure ----------
  @Get('structure')
  @Permissions('fees.view')
  structure(@Query() q: StructureQueryDto, @Scope() s: RequestScope) {
    return this.setup.getStructure(q, s);
  }

  @Put('structure')
  @Permissions('fees.manage')
  saveStructure(@Body() dto: SaveStructureDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.saveStructure(dto, s, u);
  }

  @Post('structure/copy')
  @Permissions('fees.manage')
  copyStructure(@Body() dto: CopyStructureDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.copyStructure(dto, s, u);
  }

  // ---------- concession ----------
  @Put('concessions/:enrollmentId')
  @Permissions('fees.manage')
  setConcession(@Param('enrollmentId', ParseIntPipe) id: number, @Body() dto: ConcessionDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.setConcession(id, dto, s, u);
  }

  @Delete('concessions/:enrollmentId')
  @Permissions('fees.manage')
  removeConcession(@Param('enrollmentId', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.setup.removeConcession(id, s, u);
  }

  // ---------- ledger & collection ----------
  @Get('ledger/:enrollmentId')
  @Permissions('fees.view')
  ledgerFor(@Param('enrollmentId', ParseIntPipe) id: number, @Scope() s: RequestScope) {
    return this.ledger.forEnrollment(id, s.sessionId);
  }

  @Post('payments')
  @Permissions('fees.collect')
  collect(@Body() dto: CollectFeeDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.collection.collect(dto, s, u);
  }

  @Get('payments')
  @Permissions('fees.view')
  payments(@Query() q: PaymentQueryDto, @Scope() s: RequestScope) {
    return this.collection.list(q, s);
  }

  @Get('payments/:id')
  @Permissions('fees.view')
  payment(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope) {
    return this.collection.findOne(id, s);
  }

  @Get('payments/:id/receipt.pdf')
  @Permissions('fees.view')
  async receipt(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @Res() res: Response) {
    const pdf = await this.collection.receiptPdf(id, s);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="receipt-${id}.pdf"`, 'Cache-Control': 'no-store' });
    res.end(pdf);
  }

  @Post('payments/:id/cancel')
  @Permissions('fees.cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelPaymentDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.collection.cancel(id, dto, s, u);
  }

  @Get('dues')
  @Permissions('fees.view')
  dues(@Query() q: DuesQueryDto, @Scope() s: RequestScope) {
    return this.collection.dues(q, s);
  }

  @Get('due-slips/pdf')
  @Permissions('fees.view')
  async dueSlips(@Query() q: DueSlipQueryDto, @Scope() s: RequestScope, @Res() res: Response) {
    const pdf = await this.collection.dueSlipsPdf(q, s);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="fee-due-slips.pdf"', 'Cache-Control': 'no-store' });
    res.end(pdf);
  }

  @Get('summary')
  @Permissions('fees.view')
  summary(@Scope() s: RequestScope) {
    return this.collection.summary(s);
  }
}
