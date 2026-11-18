import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, SKIP_SCOPE_KEY } from '../constants';
import { AppRequest } from '../interfaces/request-context';

/** Route needs no login */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Route needs ALL listed permissions, e.g. @Permissions('students.view') */
export const Permissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

/** Route does not need session/medium scope resolution */
export const SkipScope = () => SetMetadata(SKIP_SCOPE_KEY, true);

/** Logged-in user from the access token */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().user;
});

/** Active { sessionId, mediumId } for this request */
export const Scope = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().scope;
});
