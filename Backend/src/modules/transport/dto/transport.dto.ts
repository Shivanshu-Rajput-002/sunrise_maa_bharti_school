import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateRouteDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) annualFee: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRouteDto extends PartialType(CreateRouteDto) {}

export class CreateBusDto {
  @IsString() @MinLength(2) @MaxLength(20) busNo: string;
  @IsOptional() @IsString() @MaxLength(500) stops?: string | null;
  @IsOptional() @IsString() @MaxLength(100) driverName?: string;
  @IsOptional() @Matches(/^[6-9]\d{9}$/, { message: 'Driver mobile must be 10 digits' }) driverMobile?: string;
  @IsOptional() @IsUrl({ protocols: ['https', 'http'], require_protocol: true }, { message: 'GPS link must be a full URL' }) gpsUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateBusDto extends PartialType(CreateBusDto) {}
