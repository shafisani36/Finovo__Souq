import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { User } from '../../../types';
import { AuthContext, type AuthContextValue } from '../context/auth-context';
import { ProtectedRoute } from './ProtectedRoute';

const member: User = {
  id: 'u1',
  name: 'Sara',
  email: 'sara@example.com',
  role: 'user',
  accountType: 'buyer',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
} as User;

function Where() {
  const location = useLocation();
  return <p>at {`${location.pathname}${location.search}`}</p>;
}

const renderAt = (path: string, user: User | null) => {
  const auth = { user, isAuthenticated: Boolean(user), isLoading: false } as AuthContextValue;
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><p>admin area</p></ProtectedRoute>} />
          <Route path="/account/saved" element={<ProtectedRoute><p>saved ads</p></ProtectedRoute>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

describe('ProtectedRoute', () => {
  it('sends guests to sign in and remembers where they were going', () => {
    renderAt('/account/saved', null);
    expect(screen.getByText('at /login?redirect=%2Faccount%2Fsaved')).toBeInTheDocument();
  });

  it('shows the page to a signed-in user', () => {
    renderAt('/account/saved', member);
    expect(screen.getByText('saved ads')).toBeInTheDocument();
  });

  it('keeps members out of the admin area', () => {
    renderAt('/admin/users', member);
    expect(screen.queryByText('admin area')).not.toBeInTheDocument();
    expect(screen.getByText('at /account/dashboard')).toBeInTheDocument();
  });
});
