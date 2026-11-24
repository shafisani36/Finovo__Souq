import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useAuth } from '../context/useAuth';
import { ROLE_HOME } from '../rbac';

/** Sign-in and sign-up pages: a signed-in user is sent to their dashboard */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState fullScreen label="Checking your session..." />;
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <>{children}</>;
}
