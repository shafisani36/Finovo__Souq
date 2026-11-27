import { t } from '../../i18n';
/** Same email check the backend uses (backend/src/modules/auth/auth.validation.js) */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors validatePassword in backend/src/services/password.service.js */
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: t('At least 8 characters'), test: (v) => v.length >= 8 },
  { label: t('An uppercase letter'), test: (v) => /[A-Z]/.test(v) },
  { label: t('A lowercase letter'), test: (v) => /[a-z]/.test(v) },
  { label: t('A number'), test: (v) => /[0-9]/.test(v) },
  { label: t('A special character'), test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** bcrypt only reads the first 72 bytes, so the backend rejects longer passwords */
export function passwordTooLong(value: string): boolean {
  return new TextEncoder().encode(value).length > 72;
}

/** Accepts 05XXXXXXXX, 5XXXXXXXX or +9665XXXXXXXX and returns +9665XXXXXXXX */
export function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  const match = digits.match(/^(?:\+?966|0)?(5\d{8})$/);
  return match ? `+966${match[1]}` : null;
}
