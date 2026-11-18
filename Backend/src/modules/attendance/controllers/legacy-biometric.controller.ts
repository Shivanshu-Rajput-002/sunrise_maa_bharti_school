import { Body, Controller, HttpCode, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public, SkipScope } from '../../../common/decorators';
import { AttendanceService } from '../services/attendance.service';

/**
 * The biometric machine was configured for the old site's URL:
 *   POST /Api/attendence.php?apiKey=…
 * This route lives outside the /api prefix (see main.ts) and answers in the old
 * raw format, so the machine needs no reconfiguration — only the domain must point here.
 */
@Public()
@SkipScope()
@Controller('Api')
export class LegacyBiometricController {
  constructor(private readonly attendance: AttendanceService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('attendence.php')
  @HttpCode(200)
  async ingest(@Query('apiKey') apiKey: string | undefined, @Body() body: unknown, @Res() res: Response) {
    // Raw JSON, without the {success,data} envelope the rest of the API uses
    res.json(await this.attendance.ingestLegacy(apiKey, body));
  }
}
