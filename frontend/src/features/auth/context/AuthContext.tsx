import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, SESSION_EXPIRED_EVENT } from '../../../api/client';
import { authService } from '../../../services/auth.service';
import type { AuthSession, RegisterPayload, User } from '../../../types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(apiClient.getAccessToken()));

  useEffect(() => {
    if (!apiClient.getAccessToken()) return;
    let active = true;
    // The API client refreshes an expired access token once before giving up
    authService
      .getProfile()
      .then((restored) => {
        if (!active) return;
        setUserState(restored);
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
      if (!session) return null;
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

  const setUser = useCallback((next: User) => setUserState(next), []);

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
