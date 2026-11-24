import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Eye, MessageSquare, ShieldCheck, Store } from 'lucide-react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

const SLIDES = [
  { title: 'Buy and sell with people near you', text: 'Cars, flats, phones, furniture and local services across Saudi Arabia, all in one place.' },
  { title: 'Every ad is checked before it goes live', text: 'Our team reviews each ad, so buyers see real items with honest prices and details.' },
  { title: 'Chat safely without sharing your number', text: 'Talk to buyers and sellers inside Finovo Souq and keep your phone number private.' },
];

const SLIDE_MS = 6000;
const CURRENT_YEAR = new Date().getFullYear();
const BARS = [38, 52, 44, 66, 58, 80, 72, 94, 76, 88];

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sign in / Create account switch above the form */
  showTabs?: boolean;
}

export function AuthLayout({ title, subtitle, children, showTabs = true }: AuthLayoutProps) {
  const [searchParams] = useSearchParams();
  const [slide, setSlide] = useState(0);
  const redirect = searchParams.get('redirect');
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  // Rotate the messages, unless the visitor asked for reduced motion
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slide]);

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-showcase" aria-label="About Finovo Souq">
          <div className="auth-showcase__preview" aria-hidden="true">
            <div className="auth-mock auth-mock--chart">
              <div className="auth-mock__head">
                <span>Ad performance</span>
                <span className="auth-mock__muted">Last 30 days</span>
              </div>
              <div className="auth-mock__figure">
                <strong>5,600</strong>
                <span className="auth-mock__delta">+19%</span>
              </div>
              <span className="auth-mock__muted">Views on your ads</span>
              <div className="auth-mock__bars">
                {BARS.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} className={i === BARS.length - 3 ? 'is-active' : undefined} />
                ))}
              </div>
            </div>

            <div className="auth-mock auth-mock--listing">
              <div className="auth-mock__head">
                <span>Your ad is live</span>
                <span className="auth-mock__pill">
                  <ShieldCheck size={11} /> Approved
                </span>
              </div>
              <div className="auth-mock__row">
                <span className="auth-mock__thumb">
                  <Store size={16} />
                </span>
                <span className="auth-mock__text">
                  <strong>Toyota Camry GLE 2022</strong>
                  <span className="auth-mock__muted">Cars · Riyadh</span>
                </span>
                <strong className="auth-mock__price">SAR 92,000</strong>
              </div>
              <div className="auth-mock__stats">
                <span>
                  <Eye size={12} /> 1,840 views
                </span>
                <span>
                  <MessageSquare size={12} /> 6 chats
                </span>
              </div>
            </div>

            <div className="auth-mock auth-mock--message">
              <span className="auth-mock__avatar">SA</span>
              <span className="auth-mock__text">
                <strong>Sara Al-Otaibi</strong>
                <span className="auth-mock__muted">Is the Camry still available?</span>
              </span>
              <span className="auth-mock__dot" />
            </div>
          </div>

          <div className="auth-showcase__copy">
            <span className="auth-showcase__mark" aria-hidden="true">
              <Store size={22} />
            </span>
            <div className="auth-showcase__slide" aria-live="polite" key={slide}>
              <h2>{SLIDES[slide].title}</h2>
              <p>{SLIDES[slide].text}</p>
            </div>
            <div className="auth-showcase__dots" role="tablist" aria-label="Messages">
              {SLIDES.map((s, i) => (
                <button key={s.title} type="button" role="tab" aria-selected={slide === i} aria-label={`Message ${i + 1}`} onClick={() => setSlide(i)} />
              ))}
            </div>
          </div>
        </aside>

        <main className="auth-panel">
          <div className="auth-panel__top">
            <Logo />
            <Link to="/" className="auth-panel__back">
              <ArrowLeft size={15} /> Back to home
            </Link>
          </div>

          <div className="auth-panel__body">
            <h1 className="auth-panel__title">{title}</h1>
            {subtitle && <p className="auth-panel__subtitle">{subtitle}</p>}
            {showTabs && (
              <nav className="auth-tabs" aria-label="Account">
                <NavLink to={`/login${query}`} className="auth-tabs__item">
                  Sign in
                </NavLink>
                <NavLink to={`/register${query}`} className="auth-tabs__item">
                  Create account
                </NavLink>
              </nav>
            )}
            {children}
          </div>

          <p className="auth-panel__foot">© {CURRENT_YEAR} Finovo Souq. All prices in SAR.</p>
        </main>
      </div>
    </div>
  );
}
