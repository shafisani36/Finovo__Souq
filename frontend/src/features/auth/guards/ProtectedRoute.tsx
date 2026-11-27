import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../../../components/ui/LoadingState';
import type { UserRole } from '../../../types';
import { useAuth } from '../context/useAuth';
import { ROLE_HOME } from '../rbac';
import { t } from '../../../i18n';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Leave empty to allow any signed-in user */
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState fullScreen label={t('Checking your session...')} />;

  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // A signed-in user in the wrong area goes to their own dashboard
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}

export function DashboardRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState fullScreen label={t('Checking your session...')} />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
}
