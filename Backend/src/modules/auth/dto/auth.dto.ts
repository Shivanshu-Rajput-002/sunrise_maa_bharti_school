import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  username: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;

  /** Optional — the current session is used when omitted (session is switched from the dashboard) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sessionId?: number;
}

export class RefreshDto {
  /** Session currently selected in the dashboard switcher */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sessionId?: number;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}
