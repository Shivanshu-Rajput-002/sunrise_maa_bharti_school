import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { CreateBusDto, CreateRouteDto, UpdateBusDto, UpdateRouteDto } from '../dto/transport.dto';
import { TransportService } from '../services/transport.service';

@Controller('transport')
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Get('routes')
  @Permissions('transport.view')
  routes(@Scope() s: RequestScope) {
    return this.transport.listRoutes(s);
  }

  @Post('routes')
  @Permissions('transport.manage')
  createRoute(@Body() dto: CreateRouteDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.transport.createRoute(dto, s, u);
  }

  @Post('routes/copy-from/:sessionId')
  @Permissions('transport.manage')
  copy(@Param('sessionId', ParseIntPipe) from: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.transport.copyRoutes(from, s, u);
  }

  @Patch('routes/:id')
  @Permissions('transport.manage')
  updateRoute(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRouteDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.transport.updateRoute(id, dto, s, u);
  }

  @Delete('routes/:id')
  @Permissions('transport.manage')
  removeRoute(@Param('id', ParseIntPipe) id: number, @Scope() s: RequestScope, @CurrentUser() u: AuthUser) {
    return this.transport.removeRoute(id, s, u);
  }

  @Get('buses')
  @Permissions('transport.view')
  buses() {
    return this.transport.listBuses();
  }

  @Post('buses')
  @Permissions('transport.manage')
  createBus(@Body() dto: CreateBusDto, @CurrentUser() u: AuthUser) {
    return this.transport.createBus(dto, u);
  }

  @Patch('buses/:id')
  @Permissions('transport.manage')
  updateBus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBusDto, @CurrentUser() u: AuthUser) {
    return this.transport.updateBus(id, dto, u);
  }

  @Delete('buses/:id')
  @Permissions('transport.manage')
  removeBus(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.transport.removeBus(id, u);
  }
}
