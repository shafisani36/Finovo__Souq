import { BadgeCheck, MapPin, Store as StoreIcon } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ListingCard, ListingCardSkeleton } from '../../components/listings/ListingCard';
import { Avatar } from '../../components/ui/Avatar';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listingsService } from '../../services/listings.service';
import { storesService } from '../../services/stores.service';
import { formatDate, formatNumber } from '../../utils/format';
import { t, tn } from '../../i18n';

/** Public page of a verified business: who they are and all of their live ads */
export function StorePage() {
  const { slug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const store = useAsync(() => storesService.bySlug(slug), [slug]);
  const sellerId = store.data?.sellerId;
  const listings = useAsync(() => (sellerId ? listingsService.search({ seller: sellerId, page, pageSize: 12 }) : Promise.resolve(null)), [sellerId, page]);
  useDocumentTitle(store.data?.name ?? 'Store');

  if (store.isLoading) return <LoadingState label={t('Loading store...')} />;
  if (store.error || !store.data) {
    return (
      <div className="container section-lg">
        <ErrorState error={store.error} onRetry={store.reload} title={t('We could not find this store')} />
      </div>
    );
  }

  const s = store.data;
  return (
    <section className="section-lg">
      <div className="container">
        <header className="card store-hero">
          <Avatar name={s.name} src={s.logoUrl} size="xl" />
          <div className="store-hero__body">
            <h1 className="store-hero__name">{s.name}</h1>
            <p className="store-hero__meta">
              <span className="badge badge--success">
                <BadgeCheck size={13} /> {t('Verified business')}
              </span>
              {s.city && (
                <span>
                  <MapPin size={14} /> {t(s.city)}
                </span>
              )}
              <span>
                {tn(s.activeListings ?? 0, '{count} live ad', '{count} live ads', { count: formatNumber(s.activeListings ?? 0) })}
              </span>
            </p>
            {s.description && <p className="store-hero__description">{s.description}</p>}
            <p className="store-hero__note">
              {t("Our team checked this business's commercial registration")}
              {s.verifiedAt ? ` on ${formatDate(s.verifiedAt)}` : ''}
              {t('. Still check every item before you pay.')} <Link to={`/sellers/${s.sellerId}`}>{t('Seller profile')}</Link>
            </p>
          </div>
        </header>

        {listings.error ? (
          <ErrorState error={listings.error} onRetry={listings.reload} />
        ) : listings.isLoading || !listings.data ? (
          <div className="listing-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.data.items.length === 0 ? (
          <div className="card">
            <EmptyState icon={<StoreIcon size={26} />} title={t('No live ads right now')} text={t('This store has no ads on sale at the moment. Check back later.')} />
          </div>
        ) : (
          <>
            <div className="listing-grid">
              {listings.data.items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            <Pagination
              page={listings.data.page}
              totalPages={listings.data.totalPages}
              onChange={(next) => {
                setSearchParams(next > 1 ? { page: String(next) } : {}, { replace: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}
