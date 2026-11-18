import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9._@-]+$/, { message: 'username can contain letters, numbers and . _ @ - only' })
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' })
  mobile?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @Type(() => Number)
  @IsInt()
  roleId: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roleId?: number;
}
