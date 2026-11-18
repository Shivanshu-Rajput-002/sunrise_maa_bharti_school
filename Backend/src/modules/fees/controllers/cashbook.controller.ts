import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { CashbookQueryDto, CreateCashbookEntryDto, CreateCashbookHeadDto, UpdateCashbookEntryDto, UpdateCashbookHeadDto } from '../dto/fee.dto';
import { CashbookService } from '../services/cashbook.service';

@Controller('cashbook')
export class CashbookController {
  constructor(private readonly cashbook: CashbookService) {}

  @Get('heads')
  @Permissions('cashbook.view')
  heads() {
    return this.cashbook.listHeads();
  }

  @Post('heads')
  @Permissions('cashbook.create')
  createHead(@Body() dto: CreateCashbookHeadDto, @CurrentUser() u: AuthUser) {
    return this.cashbook.createHead(dto, u);
  }

  @Patch('heads/:id')
  @Permissions('cashbook.update')
  updateHead(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashbookHeadDto, @CurrentUser() u: AuthUser) {
    return this.cashbook.updateHead(id, dto, u);
  }

  @Delete('heads/:id')
  @Permissions('cashbook.delete')
  removeHead(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.cashbook.removeHead(id, u);
  }

  @Get('entries')
  @Permissions('cashbook.view')
  list(@Query() q: CashbookQueryDto, @Scope() s: RequestScope) {
    return this.cashbook.list(q, s);
  }

  @Post('entries')
  @Permissions('cashbook.create')
  create(@Body() dto: CreateCashbookEntryDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.cashbook.create(dto, s, u);
  }

  @Patch('entries/:id')
  @Permissions('cashbook.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashbookEntryDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.cashbook.update(id, dto, s, u);
  }

  @Delete('entries/:id')
  @Permissions('cashbook.delete')
  remove(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.cashbook.remove(id, s, u);
  }
}
