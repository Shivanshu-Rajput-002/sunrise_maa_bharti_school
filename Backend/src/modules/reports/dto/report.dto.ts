import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Matches } from 'class-validator';

export const REPORT_TYPES = ['students', 'parents', 'attendance', 'collection', 'daywise', 'dues', 'installments', 'ptm'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export class ReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() classId?: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
  @IsOptional() @IsIn(['xlsx', 'pdf']) format?: 'xlsx' | 'pdf';
}
