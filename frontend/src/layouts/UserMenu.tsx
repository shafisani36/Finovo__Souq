import { useCallback, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../features/auth/context/useAuth';
import { ROLE_HOME, ROLE_LABELS, rolePath } from '../features/auth/rbac';
import { useClickOutside } from '../hooks/useClickOutside';

export function UserMenu({ showName = true }: { showName?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  if (!user) return null;

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="user-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.name} size="sm" />
        {showName && (
          <span className="user-chip__text">
            <strong>{user.name}</strong>
            <span>{ROLE_LABELS[user.role]}</span>
          </span>
        )}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="dropdown__menu" role="menu">
          <div className="dropdown__header">
            <strong>{user.name}</strong>
            <p className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>
              {user.email}
            </p>
          </div>
          <button type="button" role="menuitem" className="dropdown__item" onClick={() => go(ROLE_HOME[user.role])}>
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button type="button" role="menuitem" className="dropdown__item" onClick={() => go(rolePath(user.role, 'profile'))}>
            <UserCog size={16} /> Profile and settings
          </button>
          <button
            type="button"
            role="menuitem"
            className="dropdown__item dropdown__item--danger"
            onClick={() => {
              setOpen(false);
              // Leave the protected area first, otherwise the route guard sends the user to the sign-in page
              navigate('/', { replace: true });
              void logout();
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
