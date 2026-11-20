import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Permissions, SkipScope } from '../../../common/decorators';
import type { AuthUser } from '../../../common/interfaces/request-context';
import { AuditQueryDto, CreateRoleDto, SetRolePermissionsDto } from '../dto/role.dto';
import { AuditService } from '../services/audit.service';
import { RolesService } from '../services/roles.service';

@SkipScope()
@Controller('admin')
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  @Get('roles')
  @Permissions('roles.view')
  list() {
    return this.roles.list();
  }

  @Get('permissions')
  @Permissions('roles.view')
  catalogue() {
    return this.roles.catalogue();
  }

  @Post('roles')
  @Permissions('roles.create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.roles.create(dto, actor);
  }

  @Put('roles/:id/permissions')
  @Permissions('roles.update')
  setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.roles.setPermissions(id, dto, actor);
  }

  @Delete('roles/:id')
  @Permissions('roles.delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthUser) {
    return this.roles.remove(id, actor);
  }

  @Get('audit-logs')
  @Permissions('users.view')
  auditLogs(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @Get('audit-logs/kinds')
  @Permissions('users.view')
  auditKinds() {
    return this.audit.kinds();
  }
}
