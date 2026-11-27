import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { revealDelay } from './reveal';
import { t } from '../../i18n';

/** Dark title band at the top of the information pages (About, FAQ, Contact) */
export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text?: ReactNode }) {
  return (
    <section className="page-hero" data-header-dark>
      <div className="container page-hero__inner">
        <nav data-reveal className="page-hero__crumbs" aria-label={t('Breadcrumb')}>
          <Link to="/">{t('Home')}</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{eyebrow}</span>
        </nav>
        <h1 className="page-hero__title" data-reveal style={revealDelay(1)}>
          {title}
        </h1>
        {text && (
          <p className="page-hero__text" data-reveal style={revealDelay(2)}>
            {text}
          </p>
        )}
      </div>
    </section>
  );
}
