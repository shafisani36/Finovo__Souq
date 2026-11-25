import { createContext } from 'react';
import type { AuthSession, RegisterPayload, User } from '../../../types';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  /** Resolves to null when the account waits for admin approval */
  register: (payload: RegisterPayload) => Promise<User | null>;
  startSession: (session: AuthSession) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
