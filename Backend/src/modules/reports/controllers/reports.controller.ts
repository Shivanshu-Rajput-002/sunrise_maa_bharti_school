import { BadRequestException, Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import { SUPER_ADMIN_ROLE } from '../../../common/constants';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { RbacService } from '../../admin/services/rbac.service';
import { REPORT_TYPES, ReportQueryDto, type ReportType } from '../dto/report.dto';
import { ReportsService } from '../services/reports.service';

/** Fee reports additionally need fees.view; attendance needs attendance.view */
const EXTRA_PERMISSION: Partial<Record<ReportType, string>> = {
  collection: 'fees.view',
  daywise: 'fees.view',
  dues: 'fees.view',
  installments: 'fees.view',
  attendance: 'attendance.view',
};

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly rbac: RbacService,
  ) {}

  @Get('export/:type')
  @Permissions('reports.export')
  async export(@Param('type') type: string, @Query() q: ReportQueryDto, @Scope() s: RequestScope, @CurrentUser() u: AuthUser, @Res() res: Response) {
    if (!REPORT_TYPES.includes(type as ReportType)) throw new BadRequestException('Unknown report');
    const extra = EXTRA_PERMISSION[type as ReportType];
    if (extra && u.roleSlug !== SUPER_ADMIN_ROLE && !(await this.rbac.getPermissionKeys(u.roleId)).has(extra)) {
      throw new ForbiddenException('You do not have permission for this report');
    }
    const file = await this.reports.export(type as ReportType, q, s);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `${file.contentType === 'application/pdf' ? 'inline' : 'attachment'}; filename="${file.filename.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'no-store',
    });
    res.end(file.buffer);
  }
}
