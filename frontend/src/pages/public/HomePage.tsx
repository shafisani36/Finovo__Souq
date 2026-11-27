import { ArrowRight, BadgeCheck, Bell, LayoutGrid, Layers, LockKeyhole, MapPinned, PlusCircle, ShieldCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CtaBand } from '../../components/marketing/CtaBand';
import { FaqShowcase } from '../../components/marketing/FaqShowcase';
import { PhoneShowcase } from '../../components/marketing/PhoneShowcase';
import { revealDelay } from '../../components/marketing/reveal';
import { CategoryIcon } from '../../components/listings/CategoryIcon';
import { ListingCard, ListingCardSkeleton } from '../../components/listings/ListingCard';
import { SearchBar } from '../../components/listings/SearchBar';
import { ButtonLink } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/States';
import { SAUDI_CITIES } from '../../config/app.config';
import { FAQ_GROUPS } from '../../content/faq';
import { useAuth } from '../../features/auth/context/useAuth';
import { canSell } from '../../features/auth/rbac';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { categoriesService } from '../../services/categories.service';
import { listingsService } from '../../services/listings.service';
import { formatNumber } from '../../utils/format';
import { t, tn } from '../../i18n';

const POPULAR_SEARCHES = [
  { label: t('Camry'), to: '/search?q=Camry' },
  { label: t('Apartment for rent'), to: '/search?category=property' },
  { label: 'iPhone', to: '/search?q=iPhone' },
  { label: t('AC repair'), to: '/search?q=AC' },
  { label: t('Sofa'), to: '/search?q=sofa' },
];

const FEATURES = [
  { icon: ShieldCheck, title: t('Every ad is checked'), text: t('Our team reviews each ad before it goes live, so you see real items with honest details and prices.') },
  {
    icon: LockKeyhole,
    title: t('Chat that looks out for you'),
    text: t('Talk inside Finovo Souq without sharing your number. We warn you when a message asks for a deposit, a code or a payment link.'),
  },
  { icon: PlusCircle, title: t('Free to post, always'), text: t('Personal sellers never pay to post and never pay commission on a sale. Promoting an ad is optional.') },
  { icon: Bell, title: t('Save ads and get updates'), text: t('Keep the ads you like in one place and get notified when a seller replies or your ad is approved.') },
];

const STEPS = [
  { icon: UserPlus, title: t('Create a free account'), text: t('One account lets you buy and sell. It takes less than a minute.') },
  { icon: PlusCircle, title: t('Post or find an ad'), text: t('Post what you are selling, or search by keyword, city and category.') },
  { icon: BadgeCheck, title: t('Meet and close the deal'), text: t('Chat on Finovo Souq, meet in a public place and check the item before you pay.') },
];

const HOME_FAQ = FAQ_GROUPS.flatMap((group) => group.items).slice(0, 5);

export function HomePage() {
  useDocumentTitle('');
  const { user } = useAuth();
  const categories = useAsync(() => categoriesService.list(), []);
  const latest = useAsync(() => listingsService.search({ sort: 'latest', pageSize: 8 }), []);
  const featured = useAsync(() => listingsService.search({ featured: 'true', pageSize: 4 }), []);
  const isSeller = canSell(user);
  const joinLink = !user ? '/register' : user.role === 'admin' ? '/admin/dashboard' : isSeller ? '/account/listings/new' : '/search';

  return (
    <>
      <section className="landing-hero" aria-labelledby="hero-title" data-header-dark>
        <div className="container landing-hero__inner">
          <span className="landing-hero__badge" data-reveal>
            <ShieldCheck size={14} /> {t('Every ad reviewed before it goes live')}
          </span>
          <h1 id="hero-title" className="landing-hero__title" data-reveal style={revealDelay(1)}>
            {t('Buy and sell anything')}
            <br /> {t('across Saudi Arabia')}
          </h1>
          <p className="landing-hero__text" data-reveal style={revealDelay(2)}>
            {t('Cars, property, electronics, furniture and local services from people near you.')}
          </p>
          <div className="landing-hero__search" data-reveal style={revealDelay(3)}>
            <SearchBar categories={categories.data ?? []} variant="hero" />
          </div>
          <p className="landing-hero__popular" data-reveal style={revealDelay(4)}>
            <span>{t('Popular:')}</span>
            {POPULAR_SEARCHES.map((item) => (
              <Link key={item.label} to={item.to}>
                {item.label}
              </Link>
            ))}
          </p>
          <div className="landing-hero__phones" data-reveal style={revealDelay(5)}>
            <PhoneShowcase listings={latest.data?.items ?? []} categories={categories.data ?? []} />
          </div>
        </div>
      </section>

      <section className="stats" aria-label={t('Finovo Souq in numbers')}>
        <div className="container stats__grid">
          {[
            { icon: Layers, value: latest.data ? formatNumber(latest.data.total) : '–', label: t('Live ads right now'), note: t('Checked by our team') },
            { icon: LayoutGrid, value: categories.data ? String(categories.data.length) : '–', label: t('Categories to browse'), note: t('Each with its own filters') },
            { icon: MapPinned, value: String(SAUDI_CITIES.length), label: t('Cities across the Kingdom'), note: t('From Riyadh to Abha') },
          ].map((stat, i) => (
            <div key={stat.label} className="stat-tile" data-reveal style={revealDelay(i)}>
              <span className="stat-tile__icon">
                <stat.icon size={20} />
              </span>
              <strong className="stat-tile__value tabular">{stat.value}</strong>
              <span className="stat-tile__label">{stat.label}</span>
              <span className="stat-tile__note">{stat.note}</span>
            </div>
          ))}
          <Link to={joinLink} className="stat-join" data-reveal style={revealDelay(3)}>
            <span className="stat-join__pill">{t('Free account')}</span>
            <strong>{!user ? t('Join Finovo Souq') : isSeller ? t('Post your next ad') : t('Find your next deal')}</strong>
            <span className="stat-join__text">
              {!user ? t('Sign up free to buy, or as a seller to post ads.') : isSeller ? t('It goes live after a quick review.') : t('Browse thousands of checked ads.')}
            </span>
            <span className="stat-join__arrow" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      </section>

      <section className="section-lg" aria-labelledby="categories-title">
        <div className="container">
          <div className="section-intro" data-reveal>
            <h2 id="categories-title" className="section-intro__title">
              {t('Browse by category')}
            </h2>
            <p className="section-intro__text">{t('Every category has its own filters, so you find the right car, flat or phone faster.')}</p>
          </div>
          <div className="category-cards">
            {categories.data
              ? categories.data
                  .filter((c) => c.depth === 0)
                  .map((category, i) => (
                    <Link key={category.id} to={`/search?category=${category.slug}`} className="category-card" data-reveal style={revealDelay(i)}>
                      <span className="category-card__icon">
                        <CategoryIcon icon={category.icon} size={22} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <strong>{category.name}</strong>
                      <span className="tabular">
                        {tn(category.listingCount, '{count} ad', '{count} ads', { count: formatNumber(category.listingCount) })}
                      </span>
                    </Link>
                  ))
              : Array.from({ length: 5 }, (_, index) => <div key={index} className="category-card skeleton" aria-hidden="true" />)}
          </div>
        </div>
      </section>

      <section className="section-lg section-lg--tint" aria-labelledby="features-title">
        <div className="container">
          <div className="section-intro section-intro--center" data-reveal>
            <p className="eyebrow">{t('Why Finovo Souq')}</p>
            <h2 id="features-title" className="section-intro__title">
              {t('Buy and sell with confidence')}
            </h2>
            <p className="section-intro__text">{t('Checked ads, private chat and clear rules for everyone who uses it.')}</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((feature, i) => (
              <article key={feature.title} className="feature-card" data-reveal style={revealDelay(i)}>
                <div className="feature-card__top">
                  <span className="feature-card__icon">
                    <feature.icon size={20} />
                  </span>
                  <span className="feature-card__number">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {Boolean(featured.data?.items.length) && (
        <section className="section-lg" aria-labelledby="featured-title">
          <div className="container">
            <div className="section-intro section-intro--row" data-reveal>
              <div>
                <h2 id="featured-title" className="section-intro__title">
                  {t('Featured ads')}
                </h2>
                <p className="section-intro__text">{t('Picked by our team and shown first.')}</p>
              </div>
            </div>
            <div className="listing-grid">
              {featured.data?.items.map((listing, i) => (
                <div key={listing.id} data-reveal style={revealDelay(i % 4)}>
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section-lg" aria-labelledby="latest-title">
        <div className="container">
          <div className="section-intro section-intro--row" data-reveal>
            <div>
              <h2 id="latest-title" className="section-intro__title">
                {t('Recently added')}
              </h2>
              <p className="section-intro__text">{t('Fresh ads from sellers in your area.')}</p>
            </div>
            <ButtonLink to="/search" icon={<ArrowRight size={16} />}>
              {t('View all ads')}
            </ButtonLink>
          </div>
          {latest.error ? (
            <ErrorState error={latest.error} onRetry={latest.reload} />
          ) : (
            <div className="listing-grid">
              {latest.isLoading || !latest.data
                ? Array.from({ length: 8 }, (_, i) => <ListingCardSkeleton key={i} />)
                : latest.data.items.map((listing, i) => (
                    <div key={listing.id} data-reveal style={revealDelay(i % 4)}>
                      <ListingCard listing={listing} />
                    </div>
                  ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-lg section-lg--tint" aria-labelledby="steps-title">
        <div className="container">
          <div className="section-intro section-intro--center" data-reveal>
            <h2 id="steps-title" className="section-intro__title">
              {t('How it works')}
            </h2>
            <p className="section-intro__text">{t('Three simple steps from posting to a done deal.')}</p>
          </div>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="steps__item" data-reveal style={revealDelay(index)}>
                <span className="steps__number">{String(index + 1).padStart(2, '0')}</span>
                <span className="steps__icon">
                  <step.icon size={20} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <FaqShowcase items={HOME_FAQ} />

      <CtaBand />
    </>
  );
}
