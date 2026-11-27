import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import { normalizeUser, type BackendUser } from '../api/normalize';
import type { AuthSession, RegisterPayload, User } from '../types';

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

  /** Returns null for a seller, whose account must be approved by an admin before signing in */
  async register(payload: RegisterPayload): Promise<AuthSession | null> {
    const raw = await apiClient.post<BackendSession & { pendingApproval?: boolean }>(endpoints.auth.register, payload, { skipAuth: true });
    return raw.pendingApproval ? null : toSession(raw);
  },

  forgotPassword(email: string): Promise<void> {
    return apiClient.post<void>(endpoints.auth.forgotPassword, { email }, { skipAuth: true });
  },

  async verifyResetCode(email: string, otp: string): Promise<string> {
    const { resetToken } = await apiClient.post<{ resetToken: string }>(endpoints.auth.verifyResetCode, { email, otp }, { skipAuth: true });
    return resetToken;
  },

  resetPassword(payload: { email: string; resetToken: string; password: string }): Promise<void> {
    return apiClient.post<void>(endpoints.auth.resetPassword, payload, { skipAuth: true });
  },

  /** Revokes this device's session; the backend needs the session id in the body */
  logout(sessionId: string | null): Promise<void> {
    return apiClient.post<void>(endpoints.auth.logout, { sessionId });
  },

  logoutAllDevices(): Promise<void> {
    return apiClient.post<void>(endpoints.auth.logoutAll);
  },

  async getProfile(): Promise<User> {
    return normalizeUser(await apiClient.get<BackendUser>(endpoints.users.me));
  },


  async updateMe(payload: Partial<Pick<User, 'name' | 'city' | 'phone'>>): Promise<User> {
    return normalizeUser(await apiClient.patch<BackendUser>(endpoints.users.me, payload));
  },

  async uploadAvatar(file: File): Promise<User> {
    const form = new FormData();
    form.append('avatar', file);
    return normalizeUser(await apiClient.post<BackendUser>(endpoints.users.avatar, form, { timeoutMs: 60000 }));
  },

  async removeAvatar(): Promise<User> {
    return normalizeUser(await apiClient.delete<BackendUser>(endpoints.users.avatar));
  },

  requestDeletion(reason: string): Promise<void> {
    return apiClient.post<void>(endpoints.users.deletionRequest, { reason });
  },

  cancelDeletion(): Promise<void> {
    return apiClient.delete<void>(endpoints.users.deletionRequest);
  },
};
