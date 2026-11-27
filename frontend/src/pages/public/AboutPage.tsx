import { Eye, HeartHandshake, MapPinned, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { CtaBand } from '../../components/marketing/CtaBand';
import { PageHero } from '../../components/marketing/PageHero';
import { SAUDI_CITIES } from '../../config/app.config';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { categoriesService } from '../../services/categories.service';
import { listingsService } from '../../services/listings.service';
import { formatNumber } from '../../utils/format';
import { t } from '../../i18n';

const VALUES = [
  { icon: ShieldCheck, title: t('Trust first'), text: t('Every ad is reviewed before it goes live, and every report from the community is checked by a person.') },
  { icon: Sparkles, title: t('Simple to use'), text: t('Posting takes minutes, search filters fit each category, and everything works on a phone.') },
  { icon: MapPinned, title: t('Built for Saudi Arabia'), text: t('Prices in SAR, ads organised by city and district, and categories people here actually use.') },
];

const MODERATION = [
  { title: t('You submit an ad'), text: t('Add details and photos, then send it for review.') },
  { title: t('Our team checks it'), text: t('We look for prohibited items, misleading prices and missing details.') },
  { title: t('It goes live or comes back'), text: t('Approved ads appear in search. If something needs fixing, you get the reason.') },
  { title: t('The community keeps watch'), text: t('Anyone can report an ad, and reported ads are reviewed again.') },
];

export function AboutPage() {
  useDocumentTitle(t('About us'));
  const categories = useAsync(() => categoriesService.list(), []);
  const live = useAsync(() => listingsService.search({ pageSize: 1 }), []);

  return (
    <>
      <PageHero
        eyebrow={t('About us')}
        title={t('A safer local marketplace for Saudi Arabia')}
        text={t('Finovo Souq helps people buy and sell cars, property, everyday items and services with people near them.')}
      />

      <section className="section-lg">
        <div className="container about-story">
          <div>
            <p className="eyebrow">{t('Our story')}</p>
            <h2 className="section-intro__title">{t('Why we built Finovo Souq')}</h2>
            <p className="about-story__text">
              {t('Buying a used car or renting a flat often means scrolling through ads you cannot trust, sharing your phone number with strangers and guessing whether a price is fair.')}
            </p>
            <p className="about-story__text">
              {t(
                'Finovo Souq keeps the simple idea of classifieds, people selling to people, and adds what was missing: a review before every ad goes live, private chat inside the site and clear rules that apply to everyone.',
              )}
            </p>
          </div>
          <div className="about-stats">
            <div className="about-stats__item">
              <Eye size={18} />
              <strong className="tabular">{live.data ? formatNumber(live.data.total) : '–'}</strong>
              <span>{t('Live ads')}</span>
            </div>
            <div className="about-stats__item">
              <Users size={18} />
              <strong className="tabular">{categories.data ? categories.data.length : '–'}</strong>
              <span>{t('Categories')}</span>
            </div>
            <div className="about-stats__item">
              <MapPinned size={18} />
              <strong className="tabular">{SAUDI_CITIES.length}</strong>
              <span>{t('Cities')}</span>
            </div>
            <div className="about-stats__item">
              <HeartHandshake size={18} />
              <strong>{t('Free')}</strong>
              <span>{t('To post an ad')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-lg section-lg--tint">
        <div className="container">
          <div className="section-intro">
            <p className="eyebrow">{t('What we stand for')}</p>
            <h2 className="section-intro__title">{t('Our values')}</h2>
          </div>
          <div className="feature-grid feature-grid--3">
            {VALUES.map((value) => (
              <article key={value.title} className="feature-card">
                <span className="feature-card__icon">
                  <value.icon size={20} />
                </span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-lg">
        <div className="container">
          <div className="section-intro">
            <p className="eyebrow">{t('Moderation')}</p>
            <h2 className="section-intro__title">{t('How we keep ads honest')}</h2>
            <p className="section-intro__text">{t('The same four steps apply to every ad, from a phone charger to a villa.')}</p>
          </div>
          <ol className="timeline">
            {MODERATION.map((step, index) => (
              <li key={step.title} className="timeline__item">
                <span className="timeline__number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
