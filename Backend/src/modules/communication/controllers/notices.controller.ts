import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { CreateNoticeDto, NoticeQueryDto, UpdateNoticeDto } from '../dto/notice.dto';
import { NoticesService } from '../services/notices.service';

@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @Permissions('communication.view')
  list(@Query() q: NoticeQueryDto, @Scope() s: RequestScope) {
    return this.notices.list(q, s);
  }

  @Post()
  @Permissions('communication.send')
  create(@Body() dto: CreateNoticeDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.notices.create(dto, s, u);
  }

  @Patch(':id')
  @Permissions('communication.send')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoticeDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.notices.update(id, dto, s, u);
  }

  @Delete(':id')
  @Permissions('communication.send')
  remove(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.notices.remove(id, s, u);
  }
}
