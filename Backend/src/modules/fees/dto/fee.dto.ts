import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PAYMENT_MODES, type PaymentMode } from '../entities/fee.entities';

const Money = () => (target: object, key: string) => {
  Type(() => Number)(target, key);
  IsNumber({ maxDecimalPlaces: 2 })(target, key);
  Min(0)(target, key);
};

// ----- heads -----
export class CreateFeeHeadDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsOptional() @IsIn(['all', 'hostel']) appliesTo?: 'all' | 'hostel';
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateFeeHeadDto extends PartialType(CreateFeeHeadDto) {}

// ----- installments -----
export class CreateInstallmentDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsDateString() dueDate: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}
export class UpdateInstallmentDto extends PartialType(CreateInstallmentDto) {}

// ----- structure -----
export class StructureQueryDto {
  @Type(() => Number) @IsInt() classId: number;
  @Type(() => Number) @IsInt() mediumId: number;
}

export class StructureItemDto {
  @Type(() => Number) @IsInt() installmentId: number;
  @Type(() => Number) @IsInt() feeHeadId: number;
  @Money() amount: number;
}

export class SaveStructureDto extends StructureQueryDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StructureItemDto)
  items: StructureItemDto[];
}

export class ClassMediumDto {
  @Type(() => Number) @IsInt() classId: number;
  @Type(() => Number) @IsInt() mediumId: number;
}

export class CopyStructureDto extends StructureQueryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ClassMediumDto)
  targets: ClassMediumDto[];
}

// ----- concession -----
export class ConcessionDto {
  @IsIn(['percent', 'fixed']) type: 'percent' | 'fixed';
  @Money() value: number;
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

// ----- collection -----
export class PaymentItemDto {
  @Type(() => Number) @IsInt() installmentId: number;
  /** null = transport */
  @IsOptional() @Type(() => Number) @IsInt() feeHeadId?: number | null;
  @Money() amount: number;
}

export class CollectFeeDto {
  @Type(() => Number) @IsInt() enrollmentId: number;
  @IsDateString() paymentDate: string;
  @IsIn(PAYMENT_MODES) mode: PaymentMode;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
  @IsOptional() @IsString() @MaxLength(255) remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items: PaymentItemDto[];

  @IsOptional() @Money() discount?: number;
  @IsOptional() @Money() fine?: number;
}

export class CancelPaymentDto {
  @IsString() @MinLength(3) @MaxLength(255) reason: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(PAYMENT_MODES) mode?: PaymentMode;
  @IsOptional() @IsIn(['paid', 'cancelled']) status?: 'paid' | 'cancelled';
  @IsOptional() @Type(() => Number) @IsInt() classId?: number;
}

export class DuesQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() classId?: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  /** Only installments due on/before this date count (default today) */
  @IsOptional() @IsDateString() asOf?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') @IsBoolean() onlyDue?: boolean;
}

/** Fee due slips (before a test/exam) for a class, or for chosen students */
export class DueSlipQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() classId?: number;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() mediumId?: number;
  /** comma separated enrollment ids (instead of a class) */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map(Number).filter(Boolean) : value))
  @IsInt({ each: true })
  enrollmentIds?: number[];
  @IsOptional() @Type(() => Number) @IsInt() examId?: number;
  /** Exam start date printed on the slip (defaults to the exam's start date) */
  @IsOptional() @IsDateString() examDate?: string;
  /** Pay by this date */
  @IsDateString() lastDate: string;
  /** overdue = installments due till today (default); total = whole remaining session fee */
  @IsOptional() @IsIn(['overdue', 'total']) basis?: 'overdue' | 'total';
}

// ----- cashbook -----
export class CreateCashbookHeadDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsIn(['income', 'expense']) type: 'income' | 'expense';
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateCashbookHeadDto extends PartialType(CreateCashbookHeadDto) {}

export class CreateCashbookEntryDto {
  @Type(() => Number) @IsInt() headId: number;
  @IsDateString() entryDate: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsOptional() @IsString() @MaxLength(120) party?: string;
  @IsOptional() @IsIn(PAYMENT_MODES) mode?: PaymentMode;
  @IsOptional() @IsString() @MaxLength(255) remarks?: string;
}
export class UpdateCashbookEntryDto extends PartialType(CreateCashbookEntryDto) {}

export class CashbookQueryDto extends PaginationQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['income', 'expense']) type?: 'income' | 'expense';
  @IsOptional() @Type(() => Number) @IsInt() headId?: number;
}
