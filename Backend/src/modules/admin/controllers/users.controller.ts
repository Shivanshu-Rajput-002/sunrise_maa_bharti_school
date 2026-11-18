import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions, SkipScope } from '../../../common/decorators';
import type { AuthUser } from '../../../common/interfaces/request-context';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from '../dto/user.dto';
import { UsersService } from '../services/users.service';

@SkipScope()
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.view')
  list(@Query() query: UserQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @Permissions('users.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Post()
  @Permissions('users.create')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('users.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('users.delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthUser) {
    return this.users.remove(id, actor);
  }
}
