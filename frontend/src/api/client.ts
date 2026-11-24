import { env } from '../config/env';
import type { User } from '../types';
import { endpoints, LIVE_ENDPOINTS } from './endpoints';
import { ApiError, NETWORK_ERROR_MESSAGE, type FieldErrors } from './errors';
import { normalizeUser, type BackendUser } from './normalize';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, QueryValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Public endpoints skip the Authorization header and the refresh retry */
  skipAuth?: boolean;
}

/**
 * Backend envelope (backend/src/utils/ApiResponse.js and the error handler):
 *   success: { statusCode, success: true, message, data }
 *   failure: { success: false, message, errors?: string[] }
 * The mock API throws ApiError directly, so it never goes through this shape.
 */
interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

const TOKEN_KEY = 'souq_access_token';
const SESSION_ID_KEY = 'souq_session_id';
const USER_KEY = 'souq_user';
const DEFAULT_TIMEOUT_MS = 15000;
export const SESSION_EXPIRED_EVENT = 'souq:session-expired';

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode); the in-memory values still work for this tab
  }
}

function readStoredUser(): User | null {
  const raw = storageGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/** Reads the session id ("sid") from the access token payload; the signature is checked by the server */
function sessionIdFromToken(token: string | null): string | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sid?: unknown };
    return typeof json.sid === 'string' ? json.sid : null;
  } catch {
    return null;
  }
}

/** Backend validation errors arrive as a list of sentences; place each one under the field it is about */
const FIELD_KEYWORDS: [RegExp, string][] = [
  [/password/i, 'password'],
  [/email/i, 'email'],
  [/phone/i, 'phone'],
  [/name/i, 'name'],
];

function toFieldErrors(errors: unknown): { fields: FieldErrors; details: string[] } {
  const details = Array.isArray(errors) ? errors.filter((e): e is string => typeof e === 'string') : [];
  const fields: FieldErrors = {};
  details.forEach((sentence) => {
    const field = FIELD_KEYWORDS.find(([pattern]) => pattern.test(sentence))?.[1];
    if (!field) return;
    const text = sentence.endsWith('.') ? sentence : `${sentence}.`;
    fields[field] = fields[field] ? `${fields[field]} ${text}` : text;
  });
  return { fields, details };
}

class ApiClient {
  private accessToken: string | null = storageGet(TOKEN_KEY);
  private sessionId: string | null = storageGet(SESSION_ID_KEY);
  private sessionUser: User | null = readStoredUser();
  private refreshPromise: Promise<string | null> | null = null;

  /** Saves everything needed to stay signed in after a reload */
  setSession(session: { accessToken: string; sessionId?: string | null; user: User } | null): void {
    this.accessToken = session?.accessToken ?? null;
    this.sessionId = session ? (session.sessionId ?? sessionIdFromToken(session.accessToken)) : null;
    this.sessionUser = session?.user ?? null;
    storageSet(TOKEN_KEY, this.accessToken);
    storageSet(SESSION_ID_KEY, this.sessionId);
    storageSet(USER_KEY, this.sessionUser ? JSON.stringify(this.sessionUser) : null);
  }

  setSessionUser(user: User): void {
    this.sessionUser = user;
    storageSet(USER_KEY, JSON.stringify(user));
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getSessionId(): string | null {
    return this.sessionId ?? sessionIdFromToken(this.accessToken);
  }

  getSessionUser(): User | null {
    return this.sessionUser;
  }

  get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  delete<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /** Mock everything, or only the endpoints the backend does not serve yet */
  private usesMock(path: string): boolean {
    if (env.useMockApi) return true;
    return env.mockPendingEndpoints && !LIVE_ENDPOINTS.includes(path.split('?')[0]);
  }

  async request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    if (this.usesMock(path)) {
      const { handleMockRequest } = await import('./mock/mockServer');
      return handleMockRequest<T>(path, {
        method: options.method ?? 'GET',
        body: options.body,
        params: options.params,
        token: options.skipAuth ? null : this.accessToken,
        sessionUser: options.skipAuth ? null : this.sessionUser,
      });
    }

    const { method = 'GET', body, params, signal, timeoutMs = DEFAULT_TIMEOUT_MS, skipAuth = false } = options;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller);

    const headers: Record<string, string> = { Accept: 'application/json' };
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
    if (!skipAuth && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path, params), {
        method,
        headers,
        body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
        // Sends and receives the httpOnly refresh-token cookie
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(signal?.aborted ? 'Request cancelled.' : 'The request took too long. Please try again.', 0, 'TIMEOUT');
      }
      throw new ApiError(NETWORK_ERROR_MESSAGE, 0, 'NETWORK_ERROR');
    } finally {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }

    if (response.status === 401 && !skipAuth && !isRetry) {
      const newToken = await this.refreshAccessToken();
      if (newToken) return this.request<T>(path, options, true);
      this.setSession(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    return this.parseResponse<T>(response);
  }

  private buildUrl(path: string, params?: Record<string, QueryValue>): string {
    const url = new URL(`${env.apiBaseUrl}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;

    let payload: ApiEnvelope<T> | null = null;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    }

    if (!response.ok || payload?.success === false) {
      const { fields, details } = toFieldErrors(payload?.errors);
      const hasFieldErrors = Object.keys(fields).length > 0;
      const message =
        response.status === 400 && hasFieldErrors
          ? 'Please check the highlighted fields.'
          : details[0] ?? payload?.message ?? defaultMessageForStatus(response.status);
      throw new ApiError(message, response.status, codeForStatus(response.status), fields, { details });
    }

    if (payload && typeof payload === 'object' && 'data' in payload) return payload.data as T;
    return payload as T;
  }

  /** One refresh at a time; parallel 401s wait for the same attempt */
  refreshAccessToken(): Promise<string | null> {
    if (env.useMockApi) return Promise.resolve(null);
    if (!this.refreshPromise) {
      this.refreshPromise = fetch(this.buildUrl(endpoints.auth.refresh), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const json = (await res.json().catch(() => null)) as ApiEnvelope<{ accessToken?: string; user?: BackendUser }> | null;
          const token = json?.data?.accessToken ?? null;
          if (!token) return null;
          const user = json?.data?.user ? normalizeUser(json.data.user) : this.sessionUser;
          if (!user) return null;
          this.setSession({ accessToken: token, sessionId: sessionIdFromToken(token) ?? this.sessionId, user });
          return token;
        })
        .catch(() => null)
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }
}

function codeForStatus(status: number): string {
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'API_ERROR';
}

function defaultMessageForStatus(status: number): string {
  if (status === 400 || status === 422) return 'Please check the highlighted fields.';
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return 'You do not have permission to do this.';
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

export const apiClient = new ApiClient();
