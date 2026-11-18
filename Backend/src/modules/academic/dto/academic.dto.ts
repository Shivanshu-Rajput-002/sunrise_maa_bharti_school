import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CLASS_GROUPS, type ClassGroup } from '../entities/school-class.entity';

// ---------- Sessions ----------
export class CreateSessionDto {
  @Matches(/^\d{4}-\d{4}$/, { message: 'name must look like 2026-2027' })
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateSessionDto extends PartialType(CreateSessionDto) {}

// ---------- Classes ----------
export class CreateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nameHi?: string;

  @IsIn(CLASS_GROUPS)
  classGroup: ClassGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nextClassId?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateClassDto extends PartialType(CreateClassDto) {}

// ---------- Sections ----------
export class CreateSectionDto {
  @Type(() => Number)
  @IsInt()
  classId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateSectionDto extends PartialType(CreateSectionDto) {}

// ---------- Subjects ----------
export class CreateSubjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdditional?: boolean;
}
export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
