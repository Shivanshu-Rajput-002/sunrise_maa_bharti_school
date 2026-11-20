import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Permissions, Public, Scope, SkipScope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { CreateDeviceDto, CreateHolidayDto, MarkAttendanceDto, RegisterQueryDto, SheetQueryDto } from '../dto/attendance.dto';
import { AttendanceService } from '../services/attendance.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('sheet')
  @Permissions('attendance.view')
  sheet(@Query() q: SheetQueryDto, @Scope() s: RequestScope) {
    return this.attendance.sheet(q, s);
  }

  @Post('mark')
  @Permissions('attendance.mark')
  mark(@Body() dto: MarkAttendanceDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.attendance.mark(dto, s, u);
  }

  @Get('register')
  @Permissions('attendance.view')
  register(@Query() q: RegisterQueryDto, @Scope() s: RequestScope) {
    return this.attendance.register(q, s);
  }

  @Post('import')
  @Permissions('attendance.upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_r, f, cb) => (f.mimetype === XLSX ? cb(null, true) : cb(new BadRequestException('Upload an .xlsx file'), false)),
    }),
  )
  import(@UploadedFile() file: Express.Multer.File, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('File is required');
    return this.attendance.importExcel(file.buffer, s, u);
  }

  // ---------- holidays ----------
  @Get('holidays')
  @Permissions('attendance.view')
  holidays(@Scope() s: RequestScope) {
    return this.attendance.listHolidays(s);
  }

  @Post('holidays')
  @Permissions('attendance.mark')
  createHoliday(@Body() dto: CreateHolidayDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.attendance.createHoliday(dto, s, u);
  }

  @Delete('holidays/:id')
  @Permissions('attendance.mark')
  removeHoliday(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.attendance.removeHoliday(id, s, u);
  }

  // ---------- biometric devices ----------
  @SkipScope()
  @Get('devices')
  @Permissions('attendance.upload')
  devices() {
    return this.attendance.listDevices();
  }

  @SkipScope()
  @Post('devices')
  @Permissions('attendance.upload')
  createDevice(@Body() dto: CreateDeviceDto, @CurrentUser() u: AuthUser) {
    return this.attendance.createDevice(dto, u);
  }

  @SkipScope()
  @Patch('devices/:id')
  @Permissions('attendance.upload')
  toggle(@Param('id', ParseIntPipe) id: number, @Query('active', ParseBoolPipe) active: boolean, @CurrentUser() u: AuthUser) {
    return this.attendance.toggleDevice(id, active, u);
  }

  @SkipScope()
  @Delete('devices/:id')
  @Permissions('attendance.upload')
  removeDevice(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.attendance.removeDevice(id, u);
  }

  /** Called by the biometric machine with header X-Device-Key */
  @Public()
  @SkipScope()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('biometric')
  @HttpCode(200)
  ingest(@Headers('x-device-key') key: string | undefined, @Body() body: unknown) {
    return this.attendance.ingest(key, body);
  }
}
