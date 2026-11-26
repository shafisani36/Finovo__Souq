import { useEffect, useState } from 'react';
import { Mail, Megaphone, Menu, PlusCircle, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ButtonLink } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../features/auth/context/useAuth';
import { canSell, ROLE_HOME } from '../features/auth/rbac';
import { useAsync } from '../hooks/useAsync';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { categoriesService } from '../services/categories.service';
import { settingsService } from '../services/settings.service';
import type { SocialNetwork } from '../types';
import { UserMenu } from './UserMenu';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Browse ads', end: false },
  { to: '/about', label: 'About', end: true },
  { to: '/faq', label: 'FAQ', end: true },
  { to: '/contact', label: 'Contact', end: true },
];

const CURRENT_YEAR = new Date().getFullYear();
const SOCIAL_LABELS: Record<SocialNetwork, string> = { x: 'X', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };
const DISMISSED_KEY = 'souq.dismissedAnnouncement';

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
};
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
  const categories = useAsync(() => categoriesService.list(), []);
  const topCategories = (categories.data ?? []).filter((c) => c.depth === 0).slice(0, 6);
  const settings = useAsync(() => settingsService.get(), []);
  const contact = settings.data?.contact;
  const socialLinks = Object.entries(settings.data?.social ?? {}).filter(([, url]) => url) as [SocialNetwork, string][];
  const announcement = settings.data?.announcement;
  // A closed announcement stays closed for this visit, and comes back when the admin changes the text
  const [dismissed, setDismissed] = useState(readDismissed);
  const showAnnouncement = announcement && dismissed !== announcement.text;

  const dismissAnnouncement = () => {
    if (!announcement) return;
    setDismissed(announcement.text);
    try {
      sessionStorage.setItem(DISMISSED_KEY, announcement.text);
    } catch {
      // Storage can be blocked; the bar still closes for this page view
    }
  };
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
      {showAnnouncement && (
        <div className={`announcement announcement--${announcement.tone}`} role="status">
          <div className="container announcement__inner">
            <Megaphone size={16} aria-hidden="true" />
            <p>
              {announcement.text}
              {announcement.link &&
                (announcement.link.startsWith('/') ? (
                  <Link to={announcement.link} className="announcement__link">
                    Learn more
                  </Link>
                ) : (
                  <a href={announcement.link} className="announcement__link" target="_blank" rel="noopener noreferrer">
                    Learn more
                  </a>
                ))}
            </p>
            <button type="button" className="announcement__close" onClick={dismissAnnouncement} aria-label="Close announcement">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
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
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="site-footer__mail">
                <Mail size={15} /> {contact.email}
              </a>
            )}
            {socialLinks.length > 0 && (
              <ul className="site-footer__social" aria-label="Follow us">
                {socialLinks.map(([network, url]) => (
                  <li key={network}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {SOCIAL_LABELS[network]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4>Categories</h4>
            <ul>
              {topCategories.map((c) => (
                <li key={c.id}>
                  <Link to={`/search?category=${c.slug}`}>{c.name}</Link>
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
                <Link to="/contact">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li>
                <Link to="/help">Help centre</Link>
              </li>
              <li>
                <Link to="/faq">FAQ</Link>
              </li>
              <li>
                <Link to="/safety">Safety tips</Link>
              </li>
              <li>
                <Link to="/terms">Terms of use</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy policy</Link>
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
