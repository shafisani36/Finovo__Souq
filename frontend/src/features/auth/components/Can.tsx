import type { ReactNode } from 'react';
import { useAuth } from '../context/useAuth';
import { hasPermission, type Permission } from '../rbac';

/** Renders children only when the signed-in user's role has the permission */
export function Can({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { user } = useAuth();
  return <>{hasPermission(user?.role, permission) ? children : fallback}</>;
}
