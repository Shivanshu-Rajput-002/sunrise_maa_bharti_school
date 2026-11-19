import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CERTIFICATE_TYPES, type CertificateType } from '../entities/certificate.entity';

export class IssueCertificateDto {
  @IsIn(CERTIFICATE_TYPES) type: CertificateType;
  @IsOptional() @IsDateString() issuedOn?: string;
  @IsOptional() @IsString() @MaxLength(60) conduct?: string; // default "Good"
  @IsOptional() @IsString() @MaxLength(255) remarks?: string;
  // Transfer certificate only
  @IsOptional() @IsDateString() leavingDate?: string;
  @IsOptional() @IsString() @MaxLength(255) leavingReason?: string;
}

/** Class-wise certificate list (Certificates page) */
export class CertificateRegisterQueryDto {
  @IsIn(CERTIFICATE_TYPES) type: CertificateType;
  @Type(() => Number) @IsInt() classId: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
}

export class IdCardQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() classId?: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
  /** comma separated student ids (alternative to class filter) */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map(Number).filter(Boolean) : value))
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  studentIds?: number[];
}

export class LinkParentDto {
  /** Link to an existing parent account (siblings share one login) … */
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  // … or create a new one
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @Matches(/^[a-zA-Z0-9._@-]{3,80}$/, { message: 'username: 3-80 letters, numbers, . _ @ -' }) username?: string;
  @IsOptional() @IsString() @MinLength(6) @MaxLength(72) password?: string;
  @IsOptional() @Matches(/^[6-9]\d{9}$/, { message: 'mobile must be 10 digits' }) mobile?: string;
}

// ---------- parents page ----------
export class ParentListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() classId?: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
  @IsOptional() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsIn(['with', 'without', 'all']) login?: 'with' | 'without' | 'all';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class BulkParentLoginsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  studentIds: number[];
}

export class ParentActiveDto {
  @IsBoolean() isActive: boolean;
}

export class UpdateParentLoginDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @Matches(/^[a-zA-Z0-9._@-]{3,80}$/, { message: 'Username can use 3-80 letters, numbers and . _ @ -' }) username?: string;
  @IsOptional() @Matches(/^([6-9]\d{9})?$/, { message: 'Mobile must be a 10-digit number' }) mobile?: string | null;
  @IsOptional() @IsString() @MinLength(6) @MaxLength(72) password?: string;
}
