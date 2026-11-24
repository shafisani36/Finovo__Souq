import { Link } from 'react-router-dom';

/** Text wordmark. Use tone="light" on the dark sidebar and dark panels. */
export function Logo({ to = '/', tone = 'dark' }: { to?: string; tone?: 'dark' | 'light' }) {
  return (
    <Link to={to} className={`logo${tone === 'light' ? ' logo--light' : ''}`} aria-label="Finovo Souq home">
      finovo<span className="logo__accent">souq</span>
    </Link>
  );
}
