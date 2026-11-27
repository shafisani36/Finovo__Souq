import { MessageCircleQuestion } from 'lucide-react';
import { CtaBand } from '../../components/marketing/CtaBand';
import { Faq } from '../../components/marketing/Faq';
import { PageHero } from '../../components/marketing/PageHero';
import { ButtonLink } from '../../components/ui/Button';
import { FAQ_GROUPS } from '../../content/faq';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { t } from '../../i18n';

export function FaqPage() {
  useDocumentTitle(t('Frequently asked questions'));

  return (
    <>
      <PageHero eyebrow="FAQ" title={t('Frequently asked questions')} text={t('Answers about buying, selling and keeping your account safe.')} />

      <section className="section-lg">
        <div className="container faq-page">
          <nav className="faq-page__nav" aria-label={t('Topics')}>
            {FAQ_GROUPS.map((group) => (
              <a key={group.title} href={`#${group.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {group.title}
              </a>
            ))}
            <div className="faq-page__help">
              <MessageCircleQuestion size={20} />
              <strong>{t('Still need help?')}</strong>
              <p>{t('Our support team answers within one working day.')}</p>
              <ButtonLink to="/contact" variant="primary" size="sm">
                {t('Contact us')}
              </ButtonLink>
            </div>
          </nav>
          <div className="faq-page__groups">
            {FAQ_GROUPS.map((group, index) => (
              <section key={group.title} id={group.title.toLowerCase().replace(/\s+/g, '-')} className="faq-page__group">
                <h2 className="faq-page__title">{group.title}</h2>
                <Faq items={group.items} defaultOpen={index === 0 ? 0 : null} />
              </section>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
