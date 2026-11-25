import { useEffect, useState } from 'react';
import { Mail, Menu, PlusCircle, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ButtonLink } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { SUPPORT_CONTACT } from '../config/app.config';
import { useAuth } from '../features/auth/context/useAuth';
import { canSell, ROLE_HOME } from '../features/auth/rbac';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { UserMenu } from './UserMenu';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Browse ads', end: false },
  { to: '/about', label: 'About', end: true },
  { to: '/faq', label: 'FAQ', end: true },
  { to: '/contact', label: 'Contact', end: true },
];

const CATEGORY_LINKS = [
  { to: '/search?category=cars', label: 'Cars' },
  { to: '/search?category=property', label: 'Property' },
  { to: '/search?category=electronics', label: 'Electronics' },
  { to: '/search?category=home-furniture', label: 'Home & Furniture' },
  { to: '/search?category=services', label: 'Services' },
];

const CURRENT_YEAR = new Date().getFullYear();
/** True while a section marked data-header-dark sits right under or behind the header */
function isOverDarkSection(): boolean {
  const header = document.querySelector('.site-header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const sections = document.querySelectorAll<HTMLElement>('[data-header-dark]');
  return Array.from(sections).some((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top <= headerBottom + 1 && rect.bottom > headerBottom;
  });
}

export function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();
  // The menu belongs to the page it was opened on, so it closes itself on navigation
  const [menuOpenedOn, setMenuOpenedOn] = useState<string | null>(null);
  const menuOpen = menuOpenedOn === location.pathname;
  // The header turns dark over dark sections (landing hero, page titles) and white everywhere else
  const [dark, setDark] = useState(false);
  const postAdLink = canSell(user) ? '/account/listings/new' : user ? null : '/login?redirect=%2Faccount%2Flistings%2Fnew';

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setDark(isOverDarkSection()));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Pages load lazily, so check again when the page content appears
    const main = document.getElementById('main');
    const content = new MutationObserver(update);
    if (main) content.observe(main, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      content.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [location.pathname]);

  useScrollReveal('main', location.pathname);

  return (
    <div className="public-shell">
      <header className={`site-header${dark ? ' site-header--dark' : ''}`}>
        <div className="container site-header__inner">
          <Logo tone={dark ? 'light' : 'dark'} />
          <nav className={`site-nav${menuOpen ? ' site-nav--open' : ''}`} aria-label="Main">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className="site-nav__link" onClick={() => setMenuOpenedOn(null)}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="site-header__actions">
            {postAdLink && (
              <ButtonLink to={postAdLink} variant="primary" size="sm" icon={<PlusCircle size={16} />} className="hide-sm">
                Post an ad
              </ButtonLink>
            )}
            {user ? (
              <UserMenu showName={false} />
            ) : (
              <ButtonLink to="/login" size="sm" className={dark ? 'btn--outline-light' : undefined}>
                Sign in
              </ButtonLink>
            )}
            <button
              type="button"
              className="icon-btn icon-btn--sm show-md site-header__toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpenedOn(menuOpen ? null : location.pathname)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>
      <main className="public-main" id="main">
        <Outlet />
      </main>
      <footer className="site-footer" data-header-dark>
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <Logo tone="light" />
            <p>Buy and sell cars, property, everyday items and services across Saudi Arabia. Finovo Souq connects buyers and sellers directly; we do not handle payments for listed items.</p>
            <a href={`mailto:${SUPPORT_CONTACT.email}`} className="site-footer__mail">
              <Mail size={15} /> {SUPPORT_CONTACT.email}
            </a>
          </div>
          <div>
            <h4>Categories</h4>
            <ul>
              {CATEGORY_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li>
                <Link to="/about">About us</Link>
              </li>
              <li>
                <Link to="/faq">FAQ</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Account</h4>
            <ul>
              {user ? (
                <li>
                  <Link to={ROLE_HOME[user.role]}>My dashboard</Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/register">Create account</Link>
                  </li>
                  <li>
                    <Link to="/login">Sign in</Link>
                  </li>
                </>
              )}
              <li>
                <Link to="/search">Browse ads</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="container site-footer__bottom">
          <span>© {CURRENT_YEAR} Finovo Souq. All prices in SAR.</span>
          <span>Meet in public places · Inspect before you pay · Never send deposits in advance</span>
        </div>
      </footer>
    </div>
  );
}
