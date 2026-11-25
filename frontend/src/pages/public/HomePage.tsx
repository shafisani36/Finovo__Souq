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

const POPULAR_SEARCHES = [
  { label: 'Camry', to: '/search?q=Camry' },
  { label: 'Apartment for rent', to: '/search?category=property' },
  { label: 'iPhone', to: '/search?q=iPhone' },
  { label: 'AC repair', to: '/search?q=AC' },
  { label: 'Sofa', to: '/search?q=sofa' },
];

const FEATURES = [
  { icon: ShieldCheck, title: 'Every ad is checked', text: 'Our team reviews each ad before it goes live, so you see real items with honest details and prices.' },
  { icon: LockKeyhole, title: 'Chat without sharing your number', text: 'Talk to buyers and sellers inside Finovo Souq. Your phone number stays private until you decide to share it.' },
  { icon: PlusCircle, title: 'Post free in minutes', text: 'Pick a category, add the details buyers care about and your photos. No fees for posting an ad.' },
  { icon: Bell, title: 'Save ads and get updates', text: 'Keep the ads you like in one place and get notified when a seller replies or your ad is approved.' },
];

const STEPS = [
  { icon: UserPlus, title: 'Create a free account', text: 'One account lets you buy and sell. It takes less than a minute.' },
  { icon: PlusCircle, title: 'Post or find an ad', text: 'Post what you are selling, or search by keyword, city and category.' },
  { icon: BadgeCheck, title: 'Meet and close the deal', text: 'Chat on Finovo Souq, meet in a public place and check the item before you pay.' },
];

const HOME_FAQ = FAQ_GROUPS.flatMap((group) => group.items).slice(0, 5);

export function HomePage() {
  useDocumentTitle('');
  const { user } = useAuth();
  const categories = useAsync(() => categoriesService.list(), []);
  const latest = useAsync(() => listingsService.search({ sort: 'newest', pageSize: 8 }), []);
  const isSeller = canSell(user);
  const joinLink = !user ? '/register' : user.role === 'admin' ? '/admin/dashboard' : isSeller ? '/account/listings/new' : '/search';

  return (
    <>
      <section className="landing-hero" aria-labelledby="hero-title" data-header-dark>
        <div className="container landing-hero__inner">
          <span className="landing-hero__badge" data-reveal>
            <ShieldCheck size={14} /> Every ad reviewed before it goes live
          </span>
          <h1 id="hero-title" className="landing-hero__title" data-reveal style={revealDelay(1)}>
            Buy and sell anything
            <br /> across Saudi Arabia
          </h1>
          <p className="landing-hero__text" data-reveal style={revealDelay(2)}>Cars, property, electronics, furniture and local services from people near you.</p>
          <div className="landing-hero__search" data-reveal style={revealDelay(3)}>
            <SearchBar categories={categories.data ?? []} variant="hero" />
          </div>
          <p className="landing-hero__popular" data-reveal style={revealDelay(4)}>
            <span>Popular:</span>
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

      <section className="stats" aria-label="Finovo Souq in numbers">
        <div className="container stats__grid">
          {[
            { icon: Layers, value: latest.data ? formatNumber(latest.data.total) : '–', label: 'Live ads right now', note: 'Checked by our team' },
            { icon: LayoutGrid, value: categories.data ? String(categories.data.length) : '–', label: 'Categories to browse', note: 'Each with its own filters' },
            { icon: MapPinned, value: String(SAUDI_CITIES.length), label: 'Cities across the Kingdom', note: 'From Riyadh to Abha' },
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
            <span className="stat-join__pill">Free account</span>
            <strong>{!user ? 'Join Finovo Souq' : isSeller ? 'Post your next ad' : 'Find your next deal'}</strong>
            <span className="stat-join__text">{!user ? 'Sign up free to buy, or as a seller to post ads.' : isSeller ? 'It goes live after a quick review.' : 'Browse thousands of checked ads.'}</span>
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
              Browse by category
            </h2>
            <p className="section-intro__text">Every category has its own filters, so you find the right car, flat or phone faster.</p>
          </div>
          <div className="category-cards">
            {categories.data
              ? categories.data.map((category, i) => (
                  <Link key={category.id} to={`/search?category=${category.slug}`} className="category-card" data-reveal style={revealDelay(i)}>
                    <span className="category-card__icon">
                      <CategoryIcon icon={category.icon} size={22} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <strong>{category.name}</strong>
                    <span className="tabular">{formatNumber(category.listingCount)} ads</span>
                  </Link>
                ))
              : Array.from({ length: 5 }, (_, index) => <div key={index} className="category-card skeleton" aria-hidden="true" />)}
          </div>
        </div>
      </section>

      <section className="section-lg section-lg--tint" aria-labelledby="features-title">
        <div className="container">
          <div className="section-intro section-intro--center" data-reveal>
            <p className="eyebrow">Why Finovo Souq</p>
            <h2 id="features-title" className="section-intro__title">
              Buy and sell with confidence
            </h2>
            <p className="section-intro__text">Checked ads, private chat and clear rules for everyone who uses it.</p>
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

      <section className="section-lg" aria-labelledby="latest-title">
        <div className="container">
          <div className="section-intro section-intro--row" data-reveal>
            <div>
              <h2 id="latest-title" className="section-intro__title">
                Recently added
              </h2>
              <p className="section-intro__text">Fresh ads from sellers in your area.</p>
            </div>
            <ButtonLink to="/search" icon={<ArrowRight size={16} />}>
              View all ads
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
              How it works
            </h2>
            <p className="section-intro__text">Three simple steps from posting to a done deal.</p>
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
