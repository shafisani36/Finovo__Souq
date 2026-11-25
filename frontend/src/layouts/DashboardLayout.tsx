import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Bell, Menu, MessageSquare, PlusCircle, Search, ShieldCheck, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ButtonLink } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../features/auth/context/useAuth';
import { NAVIGATION } from '../features/auth/navigation';
import { canSell, ROLE_HOME, rolePath } from '../features/auth/rbac';
import { UserMenu } from './UserMenu';
import { useNavCounters } from './useNavCounters';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
}

export function DashboardLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // The mobile sidebar stays open only on the page it was opened from
  const [sidebarOpenedOn, setSidebarOpenedOn] = useState<string | null>(null);
  const sidebarOpen = sidebarOpenedOn === location.pathname;
  const setSidebarOpen = (open: boolean) => setSidebarOpenedOn(open ? location.pathname : null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const counters = useNavCounters(user?.role ?? 'user', user?.id);

  // "/" focuses the search box, like most dashboards
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;
  const isAdmin = user.role === 'admin';
  const isSeller = canSell(user);
  const groups = NAVIGATION[user.role].filter((group) => !group.sellerOnly || isSeller);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (isAdmin) navigate(`/admin/moderation?status=all${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    else navigate(`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  return (
    <div className="dash">
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`} aria-label="Dashboard navigation">
        <div className="sidebar__head">
          <Logo to={ROLE_HOME[user.role]} />
          <button type="button" className="icon-btn icon-btn--sm show-lg" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>
        <nav className="sidebar__nav">
          {groups.map((group, index) => (
            <div className="sidebar__group" key={group.title ?? index}>
              {group.title && <p className="sidebar__group-title">{group.title}</p>}
              {group.items.map((item) => {
                const count = item.badgeKey ? counters[item.badgeKey] : undefined;
                return (
                  <NavLink key={item.to} to={item.to} end className="sidebar__link">
                    <item.icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {count ? <span className="count-pill">{count > 99 ? '99+' : count}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar__foot">
          {isAdmin ? (
            <div className="sidebar-note">
              <span className="sidebar-note__icon" aria-hidden="true">
                <ShieldCheck size={16} />
              </span>
              <p className="sidebar-note__title">{counters.pendingReview ? `${counters.pendingReview} ads waiting` : 'Queue is clear'}</p>
              <p className="sidebar-note__text">Ads are checked before they go live.</p>
              <Link to="/admin/moderation" className="sidebar-note__link">
                Open moderation
              </Link>
            </div>
          ) : isSeller ? (
            <div className="sidebar-note">
              <span className="sidebar-note__icon" aria-hidden="true">
                <PlusCircle size={16} />
              </span>
              <p className="sidebar-note__title">Sell something today</p>
              <p className="sidebar-note__text">Posting an ad is free and takes a few minutes.</p>
              <Link to="/account/listings/new" className="sidebar-note__link">
                Post an ad
              </Link>
            </div>
          ) : null}
          <Link to="/" className="sidebar__link">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back to marketplace</span>
          </Link>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <div className="dash__main">
        <header className="topbar">
          <button type="button" className="icon-btn show-lg" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <form className="topbar__search" role="search" onSubmit={handleSearch}>
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAdmin ? 'Search ads or sellers' : 'Search ads'}
              aria-label="Search"
            />
            <kbd className="topbar__kbd hide-sm" aria-hidden="true">
              /
            </kbd>
          </form>
          <div className="topbar__actions">
            {!isAdmin && (
              <Link to="/account/messages" className="icon-btn hide-sm" aria-label={`Messages${counters.unreadMessages ? `, ${counters.unreadMessages} unread` : ''}`}>
                <MessageSquare size={18} />
                {counters.unreadMessages ? <span className="icon-btn__dot" /> : null}
              </Link>
            )}
            <Link to={rolePath(user.role, 'notifications')} className="icon-btn" aria-label={`Notifications${counters.unreadNotifications ? `, ${counters.unreadNotifications} unread` : ''}`}>
              <Bell size={18} />
              {counters.unreadNotifications ? <span className="icon-btn__dot" /> : null}
            </Link>
            {isSeller && (
              <ButtonLink to="/account/listings/new" variant="primary" size="sm" icon={<PlusCircle size={16} />} className="hide-md">
                Post an ad
              </ButtonLink>
            )}
            <span className="topbar__divider hide-sm" aria-hidden="true" />
            <UserMenu />
          </div>
        </header>
        <main className="dash__content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
