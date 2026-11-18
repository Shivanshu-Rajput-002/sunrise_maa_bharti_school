import { ArrayUnique, IsArray, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,49}$/, { message: 'slug: lowercase letters, numbers, underscore' })
  slug: string;
}

export class UpdateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;
}

export class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];
}
