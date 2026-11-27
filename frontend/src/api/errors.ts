import { t } from '../i18n';
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;
  /** Extra data sent with an error, e.g. { details: string[] } with every backend validation message */
  readonly meta: Record<string, unknown>;

  constructor(message: string, status: number, code = 'API_ERROR', fieldErrors: FieldErrors = {}, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.meta = meta;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export const NETWORK_ERROR_MESSAGE = t('We could not reach the server. Check your connection and try again.');

/** Turns any thrown value into a message that is safe to show to the user. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message || t(fallback);
  if (error instanceof Error && error.name === 'AbortError') return t('The request took too long. Please try again.');
  return t(fallback);
}
