import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ScopeService } from '../../modules/academic/services/scope.service';
import { HEADER_MEDIUM, HEADER_SESSION, SKIP_SCOPE_KEY } from '../constants';
import { AppRequest } from '../interfaces/request-context';

/**
 * Resolves the active academic session + medium for every authenticated request.
 *  - session: X-Session-Id header (dashboard switcher) → falls back to the session chosen at login
 *  - medium:  X-Medium-Id header → null means "all mediums"
 * Services read it via @Scope() so data of one session never leaks into another.
 */
@Injectable()
export class ScopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopes: ScopeService,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SCOPE_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (skip || !req.user) return next.handle();

    const rawSession = req.headers[HEADER_SESSION];
    const rawMedium = req.headers[HEADER_MEDIUM];

    const sessionId = rawSession ? Number(rawSession) : req.user.sessionId;
    if (!(await this.scopes.isValidSession(sessionId))) {
      throw new BadRequestException('The selected session is not active. Please choose another session from the top bar.');
    }

    let mediumId: number | null = null;
    if (rawMedium && rawMedium !== 'all') {
      mediumId = Number(rawMedium);
      if (!(await this.scopes.isValidMedium(mediumId))) throw new BadRequestException('The selected medium is not valid. Please choose Hindi, English or All from the top bar.');
    }

    req.scope = { sessionId, mediumId };
    return next.handle();
  }
}
