import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SchoolProfileDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(150) tagline?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @ValidateIf((o) => o.email !== '') @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(150) affiliation?: string;
  @IsOptional() @IsString() @MaxLength(100) principal?: string;
}

export class FeeSettingsDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) fullPaymentDiscountPercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100000) lateFeePerInstallment?: number;
  @IsOptional() @Matches(/^[A-Z0-9-]{0,8}$/, { message: 'receiptPrefix: up to 8 capital letters/digits' }) receiptPrefix?: string;
}

export class GradeBandDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) min: number;
  @IsString() @MaxLength(5) grade: string;
}

export class GradesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  grades: GradeBandDto[];
}

export class PrintSettingsDto {
  @IsOptional() @IsString() @MaxLength(150) schoolName?: string;
  @IsOptional() @IsString() @MaxLength(150) schoolNameHi?: string;
  @IsOptional() @IsString() @MaxLength(150) shortName?: string;
  @IsOptional() @IsString() @MaxLength(150) certName?: string;
  @IsOptional() @IsString() @MaxLength(150) admitName?: string;
  @IsOptional() @IsString() @MaxLength(150) department?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(200) addressHi?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) udiseCode?: string;
  @IsOptional() @IsString() @MaxLength(30) pspCode?: string;
  @IsOptional() @IsString() @MaxLength(30) dicCode?: string;
  @IsOptional() @IsString() @MaxLength(30) boardCode?: string;
  @IsOptional() @IsString() @MaxLength(150) campusHi?: string;
  @IsOptional() @IsString() @MaxLength(150) campusEn?: string;
}
