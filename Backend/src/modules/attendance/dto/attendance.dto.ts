import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../entities/attendance.entities';

export class SheetQueryDto {
  @Type(() => Number) @IsInt() classId: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
  @IsDateString() date: string;
}

export class MarkRecordDto {
  @Type(() => Number) @IsInt() enrollmentId: number;
  @IsIn(ATTENDANCE_STATUSES) status: AttendanceStatus;
}

export class MarkAttendanceDto {
  @IsDateString() date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => MarkRecordDto)
  records: MarkRecordDto[];
}

export class RegisterQueryDto {
  @Type(() => Number) @IsInt() classId: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }) month: string;
}

export class CreateHolidayDto {
  @IsDateString() date: string;
  @IsString() @MinLength(2) @MaxLength(120) title: string;
}

export class CreateDeviceDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  /** Keep a machine's existing key (e.g. the one configured for the old site); generated if empty */
  @IsOptional() @IsString() @MinLength(16) @MaxLength(100) apiKey?: string;
}

/** Payload format of the biometric machine (same fields the old Joomla API accepted) */
export class BiometricPunchDto {
  @IsString() @MaxLength(30) punchId: string;
  @IsString() @MaxLength(40) txnDateTime: string; // "2026-11-18 08:05:12"
  @IsOptional() @IsString() @MaxLength(60) txnId?: string;
}
