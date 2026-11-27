import { useEffect } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PageHero } from '../../components/marketing/PageHero';
import { SafeMeetingPlaces } from '../../components/marketing/SafeMeetingPlaces';
import { RichText } from '../../components/ui/RichText';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { settingsService } from '../../services/settings.service';
import type { LegalPageSlug } from '../../types';
import { formatDate } from '../../utils/format';
import { isRtl, t } from '../../i18n';

const RELATED: { slug: LegalPageSlug; label: string }[] = [
  { slug: 'help', label: t('Help centre') },
  { slug: 'safety', label: t('Safety tips') },
  { slug: 'terms', label: t('Terms of use') },
  { slug: 'privacy', label: t('Privacy policy') },
];

/** Help centre, safety tips, terms and privacy policy; the content is edited by admins in Settings */
export function LegalPage() {
  // The route path is the page slug: /safety, /terms or /privacy
  const location = useLocation();
  const slug = location.pathname.replace(/^\/|\/$/g, '') as LegalPageSlug;
  const page = useAsync(() => settingsService.page(slug), [slug]);
  // The Arabic site shows the Arabic version when an admin has written one
  const arabic = isRtl && Boolean(page.data?.bodyAr);
  const title = (arabic ? page.data?.titleAr : page.data?.title) || page.data?.title;
  const body = (arabic ? page.data?.bodyAr : page.data?.body) ?? '';
  useDocumentTitle(title ?? RELATED.find((r) => r.slug === slug)?.label ?? '');

  // Links such as /safety#meet land on their section once the content has loaded
  const loaded = Boolean(page.data);
  useEffect(() => {
    if (loaded && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loaded, location.hash]);

  if (page.isLoading) return <LoadingState label={t('Loading...')} />;
  if (page.error || !page.data) {
    return (
      <div className="container section-lg">
        <ErrorState error={page.error} onRetry={page.reload} />
      </div>
    );
  }

  return (
    <>
      <PageHero
        eyebrow={RELATED.find((r) => r.slug === slug)?.label ?? title ?? ''}
        title={title ?? ''}
        text={t('Last updated {updatedAt}', {
          updatedAt: formatDate(page.data.updatedAt),
        })}
      />
      <section className="section-lg">
        <div className="container legal">
          <div className="legal__main">
            <article className="card legal__body">
              <RichText text={body} />
            </article>
            {slug === 'safety' && <SafeMeetingPlaces />}
          </div>
          <aside className="legal__aside">
            <div className="card">
              <p className="legal__aside-title">
                <FileText size={16} /> {t('More information')}
              </p>
              <ul>
                {RELATED.map((r) => (
                  <li key={r.slug}>{r.slug === slug ? <span aria-current="page">{r.label}</span> : <Link to={`/${r.slug}`}>{r.label}</Link>}</li>
                ))}
                <li>
                  <Link to="/faq">FAQ</Link>
                </li>
                <li>
                  <Link to="/contact">{t('Contact us')}</Link>
                </li>
              </ul>
            </div>
            {slug !== 'safety' && (
              <Link to="/safety" className="card legal__safety">
                <ShieldCheck size={18} />
                <span>
                  <strong>{t('Buying or selling soon?')}</strong>
                  {t('Read our safety tips first.')}
                </span>
              </Link>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
