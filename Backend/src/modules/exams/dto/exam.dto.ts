import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EXAM_TYPES, REPORT_COLUMNS_EN, REPORT_COLUMNS_HI, type ExamType, type ReportColumn, type ReportColumnEn } from '../entities/exam.entities';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateExamDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsIn(EXAM_TYPES) type: ExamType;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() includeInReport?: boolean;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsIn([...REPORT_COLUMNS_HI, null]) reportColumn?: ReportColumn | null;
  @IsOptional() @IsIn([...REPORT_COLUMNS_EN, null]) reportColumnEn?: ReportColumnEn | null;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string | null;
  @IsOptional() @IsDateString() resultDate?: string | null;
}
export class UpdateExamDto extends PartialType(CreateExamDto) {}

export class ScheduleItemDto {
  @Type(() => Number) @IsInt() subjectId: number;
  @IsOptional() @IsDateString() examDate?: string | null;
  @IsOptional() @Matches(TIME, { message: 'startTime must be HH:MM' }) startTime?: string | null;
  @IsOptional() @Matches(TIME, { message: 'endTime must be HH:MM' }) endTime?: string | null;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) maxMarks: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) practicalMax?: number | null;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) passMarks: number;
}

export class SaveScheduleDto {
  @Type(() => Number) @IsInt() classId: number;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  items: ScheduleItemDto[];
}

export class ClassQueryDto {
  @Type(() => Number) @IsInt() classId: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
}

export class MarksQueryDto {
  @Type(() => Number) @IsInt() scheduleId: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
}

export class MarkEntryDto {
  @Type(() => Number) @IsInt() enrollmentId: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) marks?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) practicalMarks?: number | null;
  @IsOptional() @IsBoolean() isAbsent?: boolean;
  @IsOptional() @IsString() @MaxLength(150) remarks?: string;
}

export class SaveMarksDto {
  @Type(() => Number) @IsInt() scheduleId: number;

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  records: MarkEntryDto[];
}

// ---------- marksheet extras ----------
const n = () => [IsOptional(), Type(() => Number), IsNumber({ maxDecimalPlaces: 2 }), Min(0)];
const apply = (decs: PropertyDecorator[]): PropertyDecorator => (t, k) => decs.forEach((d) => d(t, k));
const Num = (max: number) => apply([...n(), Max(max)]);
const Txt = (len: number) => apply([IsOptional(), IsString(), MaxLength(len)]);

class SupwDto { @Num(25) comp?: number; @Num(45) opt?: number; @Num(30) camp?: number; }
class ArtDto { @Num(25) theory?: number; @Num(60) practical?: number; @Num(15) assignment?: number; }
class JeevanDto { @Num(30) based?: number; @Num(30) assignment?: number; @Num(40) annual?: number; }
class CoScholasticTermDto { @Txt(5) work?: string; @Txt(5) art?: string; @Txt(5) health?: string; @Txt(5) discipline?: string; }
class CoScholasticDto {
  @IsOptional() @ValidateNested() @Type(() => CoScholasticTermDto) t1?: CoScholasticTermDto;
  @IsOptional() @ValidateNested() @Type(() => CoScholasticTermDto) t2?: CoScholasticTermDto;
}
class HealthTermDto { @Txt(10) height?: string; @Txt(10) weight?: string; }
class HealthDto {
  @IsOptional() @ValidateNested() @Type(() => HealthTermDto) t1?: HealthTermDto;
  @IsOptional() @ValidateNested() @Type(() => HealthTermDto) t2?: HealthTermDto;
}

export class MarksheetExtrasDto {
  @IsOptional() @ValidateNested() @Type(() => SupwDto) supw?: SupwDto;
  @IsOptional() @ValidateNested() @Type(() => ArtDto) art?: ArtDto;
  @IsOptional() @ValidateNested() @Type(() => JeevanDto) jeevan?: JeevanDto;
  @IsOptional() @ValidateNested() @Type(() => CoScholasticDto) coScholastic?: CoScholasticDto;
  @IsOptional() @ValidateNested() @Type(() => HealthDto) health?: HealthDto;
  @Txt(300) remark?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(400) totalMeetings?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(400) attendance?: number | null;
}
