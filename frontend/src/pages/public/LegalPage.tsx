import { FileText, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PageHero } from '../../components/marketing/PageHero';
import { RichText } from '../../components/ui/RichText';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { settingsService } from '../../services/settings.service';
import type { LegalPageSlug } from '../../types';
import { formatDate } from '../../utils/format';

const RELATED: { slug: LegalPageSlug; label: string }[] = [
  { slug: 'help', label: 'Help centre' },
  { slug: 'safety', label: 'Safety tips' },
  { slug: 'terms', label: 'Terms of use' },
  { slug: 'privacy', label: 'Privacy policy' },
];

/** Help centre, safety tips, terms and privacy policy; the content is edited by admins in Settings */
export function LegalPage() {
  // The route path is the page slug: /safety, /terms or /privacy
  const slug = useLocation().pathname.replace(/^\/|\/$/g, '') as LegalPageSlug;
  const page = useAsync(() => settingsService.page(slug), [slug]);
  useDocumentTitle(page.data?.title ?? RELATED.find((r) => r.slug === slug)?.label ?? '');

  if (page.isLoading) return <LoadingState label="Loading..." />;
  if (page.error || !page.data) {
    return (
      <div className="container section-lg">
        <ErrorState error={page.error} onRetry={page.reload} />
      </div>
    );
  }

  return (
    <>
      <PageHero eyebrow={RELATED.find((r) => r.slug === slug)?.label ?? page.data.title} title={page.data.title} text={`Last updated ${formatDate(page.data.updatedAt)}`} />
      <section className="section-lg">
        <div className="container legal">
          <article className="card legal__body">
            <RichText text={page.data.body} />
          </article>
          <aside className="legal__aside">
            <div className="card">
              <p className="legal__aside-title">
                <FileText size={16} /> More information
              </p>
              <ul>
                {RELATED.map((r) => (
                  <li key={r.slug}>
                    {r.slug === slug ? <span aria-current="page">{r.label}</span> : <Link to={`/${r.slug}`}>{r.label}</Link>}
                  </li>
                ))}
                <li>
                  <Link to="/faq">FAQ</Link>
                </li>
                <li>
                  <Link to="/contact">Contact us</Link>
                </li>
              </ul>
            </div>
            {slug !== 'safety' && (
              <Link to="/safety" className="card legal__safety">
                <ShieldCheck size={18} />
                <span>
                  <strong>Buying or selling soon?</strong>
                  Read our safety tips first.
                </span>
              </Link>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
