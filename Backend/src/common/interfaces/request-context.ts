import { Request } from 'express';

export interface AuthUser {
  id: number;
  roleId: number;
  roleSlug: string;
  /** Session chosen at login (default scope) */
  sessionId: number;
}

export interface RequestScope {
  sessionId: number;
  /** null = all mediums */
  mediumId: number | null;
}

export interface AppRequest extends Request {
  user?: AuthUser;
  scope?: RequestScope;
}
