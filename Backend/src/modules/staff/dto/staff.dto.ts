import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { STAFF_ATTENDANCE_STATUSES, type StaffAttendanceStatus } from '../entities/staff.entities';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateStaffDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) designation?: string | null;
  @IsOptional() @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' }) mobile?: string | null;
  @IsOptional() @IsString() @MaxLength(30) biometricId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() userId?: number | null;
  @IsOptional() @IsDateString() joiningDate?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateStaffDto extends PartialType(CreateStaffDto) {}

export class StaffListQueryDto {
  @IsOptional() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsIn(['active', 'inactive', 'all']) status?: 'active' | 'inactive' | 'all';
}

export class StaffDayQueryDto {
  @IsDateString() date: string;
}

export class StaffMarkItemDto {
  @Type(() => Number) @IsInt() staffId: number;
  /** null clears the day's mark */
  @IsOptional() @IsIn([...STAFF_ATTENDANCE_STATUSES, null]) status: StaffAttendanceStatus | null;
  @IsOptional() @Matches(TIME, { message: 'inTime must be HH:MM' }) inTime?: string | null;
  @IsOptional() @Matches(TIME, { message: 'outTime must be HH:MM' }) outTime?: string | null;
}

export class StaffMarkDto {
  @IsDateString() date: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StaffMarkItemDto)
  records: StaffMarkItemDto[];
}

export class StaffRegisterQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }) month: string;
}

export class StaffSettingsDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'lateAfter must be HH:MM' }) lateAfter: string;
}
