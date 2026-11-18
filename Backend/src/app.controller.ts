import { Controller, Get } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Public, SkipScope } from './common/decorators';

@Public()
@SkipScope()
@Controller('health')
export class AppController {
  constructor(private readonly sequelize: Sequelize) {}

  /** Liveness + DB connectivity (used by PM2 / load balancer checks) */
  @Get()
  async health() {
    let db = 'up';
    try {
      await this.sequelize.authenticate();
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, time: new Date().toISOString() };
  }
}
