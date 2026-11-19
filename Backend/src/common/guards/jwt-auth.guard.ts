import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../constants';
import { AppRequest, AuthUser } from '../interfaces/request-context';

/** Global guard: verifies the Bearer access token unless the route is @Public() */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const [type, token] = (req.headers.authorization || '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Please sign in to continue.');

    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; rid: number; role: string; sid: number }>(token);
      const user: AuthUser = { id: payload.sub, roleId: payload.rid, roleSlug: payload.role, sessionId: payload.sid };
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Your login has expired. Please sign in again.');
    }
  }
}
