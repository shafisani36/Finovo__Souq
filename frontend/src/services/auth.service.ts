import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import { normalizeUser, type BackendUser } from '../api/normalize';
import type { AuthSession, RegisterPayload, User, UserRole } from '../types';

/** POST /auth/login and /auth/register respond with { user, accessToken, sessionId } */
interface BackendSession {
  user: BackendUser;
  accessToken: string;
  sessionId?: string;
}

const toSession = (raw: BackendSession): AuthSession => ({
  accessToken: raw.accessToken,
  sessionId: raw.sessionId ?? null,
  user: normalizeUser(raw.user),
});

export const authService = {
  async login(email: string, password: string): Promise<AuthSession> {
    const raw = await apiClient.post<BackendSession>(endpoints.auth.login, { email, password }, { skipAuth: true });
    return toSession(raw);
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    const raw = await apiClient.post<BackendSession>(endpoints.auth.register, payload, { skipAuth: true });
    return toSession(raw);
  },

  /** Revokes this device's session; the backend needs the session id in the body */
  logout(sessionId: string | null): Promise<void> {
    return apiClient.post<void>(endpoints.auth.logout, { sessionId });
  },

  logoutAllDevices(): Promise<void> {
    return apiClient.post<void>(endpoints.auth.logoutAll);
  },

  /** GET /auth/me only returns { id, role } for the token owner */
  async getMe(): Promise<{ id: string; role: UserRole }> {
    const data = await apiClient.get<{ user: { id: string; role: string } }>(endpoints.auth.me);
    return { id: String(data.user.id), role: data.user.role === 'admin' ? 'admin' : 'user' };
  },

  forgotPassword(email: string): Promise<void> {
    return apiClient.post<void>(endpoints.auth.forgotPassword, { email }, { skipAuth: true });
  },

  updateMe(payload: Partial<Pick<User, 'name' | 'city' | 'phone'>>): Promise<User> {
    return apiClient.patch<User>(endpoints.users.me, payload);
  },

  requestDeletion(reason: string): Promise<void> {
    return apiClient.post<void>(endpoints.users.deletionRequest, { reason });
  },
};
