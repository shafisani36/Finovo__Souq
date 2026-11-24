import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, SESSION_EXPIRED_EVENT } from '../../../api/client';
import { authService } from '../../../services/auth.service';
import type { AuthSession, RegisterPayload, User } from '../../../types';
import { AuthContext, type AuthContextValue } from './auth-context';

/**
 * Restores a stored session on load.
 * GET /auth/me confirms the token (the API client refreshes it once if it expired) and returns the
 * current role; the rest of the profile comes from the copy saved at sign-in or from a refresh.
 */
async function restoreSession(): Promise<User | null> {
  const me = await authService.getMe();
  const stored = apiClient.getSessionUser();
  if (stored && stored.id === me.id) {
    const user = { ...stored, role: me.role };
    apiClient.setSessionUser(user);
    return user;
  }
  // No usable copy of the profile: a refresh returns the full user
  const token = await apiClient.refreshAccessToken();
  return token ? apiClient.getSessionUser() : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(apiClient.getAccessToken()));

  useEffect(() => {
    if (!apiClient.getAccessToken()) return;
    let active = true;
    restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored) setUserState(restored);
        else apiClient.setSession(null);
      })
      .catch(() => {
        if (active) apiClient.setSession(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleExpired = () => setUserState(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const startSession = useCallback((session: AuthSession) => {
    apiClient.setSession(session);
    setUserState(session.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authService.login(email, password);
      startSession(session);
      return session.user;
    },
    [startSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const session = await authService.register(payload);
      startSession(session);
      return session.user;
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    const sessionId = apiClient.getSessionId();
    try {
      await authService.logout(sessionId);
    } catch {
      // Clear the local session even if the server call fails
    } finally {
      apiClient.setSession(null);
      setUserState(null);
    }
  }, []);

  const setUser = useCallback((next: User) => {
    apiClient.setSessionUser(next);
    setUserState(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      startSession,
      logout,
      setUser,
    }),
    [user, isLoading, login, register, startSession, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
