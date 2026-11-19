import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Permissions, SkipScope } from '../../../common/decorators';
import type { AuthUser } from '../../../common/interfaces/request-context';
import { CreateStaffDto, StaffDayQueryDto, StaffListQueryDto, StaffMarkDto, StaffRegisterQueryDto, StaffSettingsDto, UpdateStaffDto } from '../dto/staff.dto';
import { StaffService } from '../services/staff.service';

/** Staff directory + staff attendance. Not session-scoped: attendance is by date. */
@SkipScope()
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @Permissions('staff.view')
  list(@Query() q: StaffListQueryDto) {
    return this.staff.list(q);
  }

  @Post()
  @Permissions('staff.manage')
  create(@Body() dto: CreateStaffDto, @CurrentUser() u: AuthUser) {
    return this.staff.create(dto, u);
  }

  @Get('attendance')
  @Permissions('staff.view')
  day(@Query() q: StaffDayQueryDto) {
    return this.staff.day(q.date);
  }

  @Put('attendance')
  @Permissions('staff.attendance')
  mark(@Body() dto: StaffMarkDto, @CurrentUser() u: AuthUser) {
    return this.staff.mark(dto, u);
  }

  @Get('attendance/register')
  @Permissions('staff.view')
  register(@Query() q: StaffRegisterQueryDto) {
    return this.staff.register(q.month);
  }

  @Get('settings')
  @Permissions('staff.view')
  settings() {
    return this.staff.settingsGet();
  }

  @Put('settings')
  @Permissions('staff.manage')
  saveSettings(@Body() dto: StaffSettingsDto, @CurrentUser() u: AuthUser) {
    return this.staff.settingsSet(dto.lateAfter, u);
  }

  @Patch(':id')
  @Permissions('staff.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto, @CurrentUser() u: AuthUser) {
    return this.staff.update(id, dto, u);
  }
}
