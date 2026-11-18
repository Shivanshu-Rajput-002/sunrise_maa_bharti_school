import rbac from './rbac.json';

export const RBAC = rbac as {
  modules: Record<string, string[]>;
  roles: Record<string, { name: string; permissions: string[] | '*' }>;
};

/** All permission keys, e.g. "students.view" */
export const ALL_PERMISSIONS: string[] = Object.entries(RBAC.modules).flatMap(([m, actions]) =>
  actions.map((a) => `${m}.${a}`),
);

export const SUPER_ADMIN_ROLE = 'super_admin';
export const PARENT_ROLE = 'parent';

export const HEADER_SESSION = 'x-session-id';
export const HEADER_MEDIUM = 'x-medium-id';

export const REFRESH_COOKIE = 'erp_rt';

export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';
export const SKIP_SCOPE_KEY = 'skipScope';
