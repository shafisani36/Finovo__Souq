import { useId, useState } from 'react';
import { ArrowRight, HelpCircle, Mail, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FaqItem } from '../../content/faq';
import { useAsync } from '../../hooks/useAsync';
import { settingsService } from '../../services/settings.service';
import { revealDelay } from './reveal';
import { t } from '../../i18n';

/**
 * Landing page FAQ: a support card on the left and tall panels that widen when opened.
 * Below 1040px it becomes a normal vertical accordion.
 */
export function FaqShowcase({ items }: { items: FaqItem[] }) {
  const settings = useAsync(() => settingsService.get(), []);
  const supportEmail = settings.data?.contact.email;
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState<number | null>(0);
  const baseId = useId();
  const number = (i: number) => String(i + 1).padStart(2, '0');

  return (
    <section className="faq-show" aria-labelledby={`${baseId}-title`}>
      <div className="container">
        <div className="faq-show__head" data-reveal>
          <p className="eyebrow">FAQ</p>
          <h2 id={`${baseId}-title`} className="faq-show__title">
            {t('Questions people often ask')}
          </h2>
          <p className="faq-show__text">{t('Short answers about buying, selling and staying safe on Finovo Souq.')}</p>
        </div>

        <div className="faq-show__grid">
          <aside className="faq-show__support" data-reveal>
            <div>
              <span className="faq-show__support-icon">
                <HelpCircle size={22} />
              </span>
              <h3>{t('Still have a question?')}</h3>
              <p>{t('Our support team answers within one working day. Tell us what you need and we will help you out.')}</p>
              {supportEmail && (
                <a href={`mailto:${supportEmail}`} className="faq-show__mail">
                  <Mail size={16} /> {supportEmail}
                </a>
              )}
            </div>
            <div className="faq-show__support-actions">
              <Link to="/contact" className="btn btn--night btn--block">
                {t('Contact us')}
              </Link>
              <Link to="/faq" className="faq-show__all">
                {t('See all questions')} <ArrowRight size={15} />
              </Link>
            </div>
          </aside>

          {/* Wide screens: expanding panels */}
          <div className="faq-panels" role="tablist" aria-label={t('Frequently asked questions')} data-reveal style={revealDelay(1)}>
            {items.map((item, i) => {
              const isActive = active === i;
              return (
                <div key={item.question} className={`faq-panel${isActive ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${i}`}
                    aria-selected={isActive}
                    aria-controls={`${baseId}-panel-${i}`}
                    tabIndex={isActive ? 0 : -1}
                    className="faq-panel__collapsed"
                    onClick={() => setActive(i)}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                      e.preventDefault();
                      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
                      setActive(next);
                      document.getElementById(`${baseId}-tab-${next}`)?.focus();
                    }}
                  >
                    <span className="faq-panel__number">{number(i)}</span>
                    <span className="faq-panel__vertical">{item.question}</span>
                    <span className="faq-panel__plus" aria-hidden="true">
                      <Plus size={16} strokeWidth={2.6} />
                    </span>
                  </button>
                  <div id={`${baseId}-panel-${i}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${i}`} hidden={!isActive} className="faq-panel__content">
                    <div>
                      <div className="faq-panel__top">
                        <span className="faq-panel__badge">
                          {t('Question')} {number(i)}
                        </span>
                        <span className="faq-panel__close" aria-hidden="true">
                          <Plus size={16} strokeWidth={2.6} />
                        </span>
                      </div>
                      <h3>{item.question}</h3>
                      <p>{item.answer}</p>
                    </div>
                    <div className="faq-panel__foot">
                      <span>{t('Choose another question on the side')}</span>
                      <span className="faq-panel__tag">{t('Finovo Souq help')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablets and phones: vertical accordion */}
          <div className="faq-stack" data-reveal style={revealDelay(1)}>
            {items.map((item, i) => {
              const isOpen = mobileOpen === i;
              return (
                <div key={item.question} className={`faq-stack__item${isOpen ? ' is-open' : ''}`}>
                  <button type="button" className="faq-stack__question" aria-expanded={isOpen} aria-controls={`${baseId}-m-${i}`} onClick={() => setMobileOpen(isOpen ? null : i)}>
                    <span>
                      {number(i)}. {item.question}
                    </span>
                    <span className="faq-stack__plus" aria-hidden="true">
                      <Plus size={16} strokeWidth={2.6} />
                    </span>
                  </button>
                  <div id={`${baseId}-m-${i}`} className="faq-stack__collapse" role="region" aria-hidden={!isOpen}>
                    <div>
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
