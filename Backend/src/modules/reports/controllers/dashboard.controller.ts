import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { DashboardService } from '../services/dashboard.service';

@Controller('reports')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  @Permissions('dashboard.view')
  summary(@Scope() scope: RequestScope, @CurrentUser() user: AuthUser) {
    return this.dashboard.summary(scope, user);
  }
}
