import type { User, UserRole } from '../../types';

/**
 * Role-based access control for the UI.
 * The API stays the source of truth: these checks only decide what to show and where to route.
 * Roles follow the backend user model: "user" (buys and sells) and "admin".
 */
/** Only approved seller accounts can post and manage ads */
export function canSell(user: Pick<User, 'role' | 'accountType'> | null | undefined): boolean {
  return user?.role === 'user' && user.accountType === 'seller';
}

export const PERMISSIONS = {
  'dashboard:admin': ['admin'],
  'dashboard:user': ['user'],
  'listings:create': ['user'],
  'listings:manageOwn': ['user'],
  'listings:moderate': ['admin'],
  'listings:save': ['user'],
  'listings:report': ['user'],
  'messages:use': ['user'],
  'searches:save': ['user'],
  'users:manage': ['admin'],
  'reports:review': ['admin'],
  'categories:manage': ['admin'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

/** First URL segment of each role's private area */
export const ROLE_BASE: Record<UserRole, string> = {
  admin: '/admin',
  user: '/account',
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  user: '/account/dashboard',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  user: 'Member',
};

/** Builds a path inside the role's private area, e.g. rolePath('user', 'messages') -> /account/messages */
export function rolePath(role: UserRole, path: string): string {
  return `${ROLE_BASE[role]}/${path.replace(/^\//, '')}`;
}

const PRIVATE_SECTIONS: Record<string, UserRole> = { admin: 'admin', account: 'user' };
const GUEST_SECTIONS = ['login', 'register', 'forgot-password'];

/** Only same-site paths that the role may open are accepted as a post-login destination */
export function safeRedirectFor(role: UserRole, requested: string | null | undefined): string {
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return ROLE_HOME[role];
  const section = requested.split(/[/?#]/)[1] ?? '';
  if (section in PRIVATE_SECTIONS) return PRIVATE_SECTIONS[section] === role ? requested : ROLE_HOME[role];
  if (GUEST_SECTIONS.includes(section)) return ROLE_HOME[role];
  return requested;
}
