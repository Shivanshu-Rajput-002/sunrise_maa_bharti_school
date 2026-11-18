import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CATEGORIES, GENDERS, STUDENT_STATUSES, type Category, type Gender, type StudentStatus } from '../entities/student.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);
const MOBILE = /^[6-9]\d{9}$/;

/** Admission form: student profile + enrollment in the active session */
export class CreateStudentDto {
  // ----- enrollment (active session) -----
  @Type(() => Number)
  @IsInt()
  classId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number | null;

  /** Defaults to the medium selected in the header if not sent */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mediumId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rollNo?: number | null;

  @IsOptional()
  @IsBoolean()
  isHostel?: boolean;

  @IsOptional()
  @IsBoolean()
  usesTransport?: boolean;

  /** Route (village) in the active session; implies usesTransport */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  transportRouteId?: number | null;

  // ----- identity -----
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  biometricId?: string;

  /** Leave empty to auto-generate */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  admissionNo?: string;

  @IsDateString()
  admissionDate: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsIn(GENDERS)
  gender: Gender;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  religion?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{12}$/, { message: 'Aadhar must be 12 digits' })
  aadharNo?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  apaarId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  penNo?: string;

  // ----- family & contact -----
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  fatherName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  motherName?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(MOBILE, { message: 'Father mobile must be a valid 10 digit number' })
  fatherMobile?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(MOBILE, { message: 'Mother mobile must be a valid 10 digit number' })
  motherMobile?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(MOBILE, { message: 'WhatsApp number must be a valid 10 digit number' })
  whatsappNo?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Pincode must be 6 digits' })
  pincode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  previousSchool?: string;
}

export class UpdateStudentDto extends PartialType(OmitType(CreateStudentDto, ['admissionNo'] as const)) {}

export class StudentQueryDto extends PaginationQueryDto {
  /** Overrides the header medium (pages that pick a medium explicitly, e.g. roll numbers) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mediumId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @IsOptional()
  @IsIn(['studying', 'promoted', 'detained', 'left'])
  enrollmentStatus?: string;
}

export class UpdateStatusDto {
  @IsIn(STUDENT_STATUSES)
  status: StudentStatus;

  @IsOptional()
  @IsDateString()
  leavingDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  leavingReason?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  tcNo?: string;
}

export class AssignRollsDto {
  @Type(() => Number)
  @IsInt()
  classId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number | null;

  @Type(() => Number)
  @IsInt()
  mediumId: number;

  @IsIn(['name', 'admission'])
  orderBy: 'name' | 'admission';
}

export class PromoteDto {
  @Type(() => Number)
  @IsInt()
  toSessionId: number;

  @Type(() => Number)
  @IsInt()
  toClassId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toSectionId?: number | null;

  /** Enrollment ids (from the active session) to move up */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  enrollmentIds: number[];

  /** true = repeat the same class next session (detained) */
  @IsOptional()
  @IsBoolean()
  detain?: boolean;
}
