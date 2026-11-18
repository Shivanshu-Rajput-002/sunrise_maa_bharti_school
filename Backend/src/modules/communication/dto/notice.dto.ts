import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AUDIENCES, type Audience } from '../entities/notice.entity';

export class CreateNoticeDto {
  @IsString() @MinLength(3) @MaxLength(150) title: string;
  @IsOptional() @IsString() @MaxLength(5000) body?: string;
  @IsIn(AUDIENCES) audience: Audience;
  @IsOptional() @Type(() => Number) @IsInt() classId?: number | null;
  @IsDateString() publishFrom: string;
  @IsOptional() @IsDateString() publishTo?: string | null;
}
export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {}

export class NoticeQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(AUDIENCES) audience?: Audience;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() activeOnly?: boolean;
}
