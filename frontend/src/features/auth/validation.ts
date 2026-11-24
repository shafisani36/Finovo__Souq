/** Same email check the backend uses (backend/src/modules/auth/auth.validation.js) */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors validatePassword in backend/src/services/password.service.js */
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
  { label: 'A special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** bcrypt only reads the first 72 bytes, so the backend rejects longer passwords */
export function passwordTooLong(value: string): boolean {
  return new TextEncoder().encode(value).length > 72;
}
