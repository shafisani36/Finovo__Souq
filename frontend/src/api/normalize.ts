import type { User, UserRole, UserStatus } from '../types';

/** User document as the backend sends it (Mongoose toJSON: _id, no password) */
export interface BackendUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  status?: string;
  isEmailVerified?: boolean;
  city?: string | null;
  createdAt?: string;
}

/** Converts a backend user into the shape the screens use; unknown roles fall back to the least privileged one */
export function normalizeUser(raw: BackendUser): User {
  const role: UserRole = raw.role === 'admin' ? 'admin' : 'user';
  const status: UserStatus = raw.status === 'suspended' ? 'suspended' : 'active';
  return {
    id: String(raw._id ?? raw.id ?? ''),
    name: raw.name ?? '',
    email: raw.email ?? '',
    phone: raw.phone || null,
    role,
    status,
    isEmailVerified: Boolean(raw.isEmailVerified),
    city: raw.city ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}
