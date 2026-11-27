import { env } from '../config/env';
import { endpoints } from './endpoints';
import { t } from '../i18n';
import { localizeResponse } from '../i18n/localize';
import { ApiError, NETWORK_ERROR_MESSAGE, type FieldErrors } from './errors';

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
 *   failure: { success: false, message, errors?: (string | { field, message })[] }
 */
interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

const TOKEN_KEY = 'souq_access_token';
const SESSION_ID_KEY = 'souq_session_id';
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

/**
 * New modules send { field, message }; the auth module sends plain sentences,
 * which are placed under the field they mention.
 */
const FIELD_KEYWORDS: [RegExp, string][] = [
  [/password/i, 'password'],
  [/email/i, 'email'],
  [/phone/i, 'phone'],
  [/name/i, 'name'],
];

function toFieldErrors(errors: unknown): { fields: FieldErrors; details: string[] } {
  const fields: FieldErrors = {};
  const details: string[] = [];
  const add = (field: string | undefined, original: string) => {
    // Server messages are English; known ones are shown in the reader's language
    const message = t(original);
    details.push(message);
    if (!field) return;
    const text = message.endsWith('.') ? message : `${message}.`;
    fields[field] = fields[field] ? `${fields[field]} ${text}` : text;
  };
  (Array.isArray(errors) ? errors : []).forEach((item: unknown) => {
    if (typeof item === 'string') add(FIELD_KEYWORDS.find(([pattern]) => pattern.test(item))?.[1], item);
    else if (item && typeof item === 'object' && 'message' in item) {
      const { field, message } = item as { field?: unknown; message: unknown };
      add(typeof field === 'string' ? field : undefined, String(message));
    }
  });
  return { fields, details };
}

class ApiClient {
  private accessToken: string | null = storageGet(TOKEN_KEY);
  private sessionId: string | null = storageGet(SESSION_ID_KEY);
  private refreshPromise: Promise<string | null> | null = null;

  /** Saves what is needed to stay signed in after a reload */
  setSession(session: { accessToken: string; sessionId?: string | null } | null): void {
    this.accessToken = session?.accessToken ?? null;
    this.sessionId = session ? (session.sessionId ?? sessionIdFromToken(session.accessToken)) : null;
    storageSet(TOKEN_KEY, this.accessToken);
    storageSet(SESSION_ID_KEY, this.sessionId);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getSessionId(): string | null {
    return this.sessionId ?? sessionIdFromToken(this.accessToken);
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

  put<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  async request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
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

    return this.parseResponse<T>(response, path);
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

  private async parseResponse<T>(response: Response, path: string): Promise<T> {
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
          ? t('Please check the highlighted fields.')
          : (details[0] ?? (payload?.message ? t(payload.message) : defaultMessageForStatus(response.status)));
      throw new ApiError(message, response.status, codeForStatus(response.status), fields, { details });
    }

    if (payload && typeof payload === 'object' && 'data' in payload) return localizeResponse(path, payload.data as T);
    return localizeResponse(path, payload as T);
  }

  /** One refresh at a time; parallel 401s wait for the same attempt */
  refreshAccessToken(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = fetch(this.buildUrl(endpoints.auth.refresh), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const json = (await res.json().catch(() => null)) as ApiEnvelope<{ accessToken?: string }> | null;
          const token = json?.data?.accessToken ?? null;
          if (token) this.setSession({ accessToken: token, sessionId: sessionIdFromToken(token) ?? this.sessionId });
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
  if (status === 400 || status === 422) return t('Please check the highlighted fields.');
  if (status === 401) return t('Your session has ended. Please sign in again.');
  if (status === 403) return t('You do not have permission to do this.');
  if (status === 404) return t('We could not find what you were looking for.');
  if (status === 429) return t('Too many attempts. Please wait a moment and try again.');
  if (status >= 500) return t('The server had a problem. Please try again shortly.');
  return t('Something went wrong. Please try again.');
}

export const apiClient = new ApiClient();
