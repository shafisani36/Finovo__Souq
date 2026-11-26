import { BadgeCheck, CalendarDays, Layers, MapPin, Store } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ListingCard, ListingCardSkeleton } from '../../components/listings/ListingCard';
import { PageHero } from '../../components/marketing/PageHero';
import { Avatar } from '../../components/ui/Avatar';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listingsService } from '../../services/listings.service';
import { formatDate, formatNumber } from '../../utils/format';

/** Public seller page: who the seller is and all of their live ads */
export function SellerProfilePage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const seller = useAsync(() => listingsService.sellerProfile(id), [id]);
  const listings = useAsync(() => listingsService.search({ seller: id, page, pageSize: 12 }), [id, page]);
  useDocumentTitle(seller.data?.name ?? 'Seller');

  if (seller.isLoading) return <LoadingState label="Loading seller..." />;
  if (seller.error || !seller.data) {
    return (
      <div className="container section-lg">
        <ErrorState error={seller.error} onRetry={seller.reload} title="We could not find this seller" />
      </div>
    );
  }

  const s = seller.data;
  return (
    <>
      <PageHero eyebrow="Seller" title={s.name} text={`${formatNumber(s.activeListings)} live ${s.activeListings === 1 ? 'ad' : 'ads'} on Finovo Souq`} />
      <section className="section-lg">
        <div className="container seller-profile">
          <aside className="card seller-profile__card">
            <Avatar name={s.name} src={s.avatarUrl} size="xl" />
            <h2 className="seller-profile__name">{s.name}</h2>
            <ul className="seller-profile__facts">
              {s.city && (
                <li>
                  <MapPin size={15} /> {s.city}
                </li>
              )}
              <li>
                <CalendarDays size={15} /> Member since {formatDate(s.memberSince)}
              </li>
              <li>
                <Layers size={15} /> {formatNumber(s.activeListings)} live {s.activeListings === 1 ? 'ad' : 'ads'}
              </li>
            </ul>
            {s.phoneVerified && (
              <span className="badge badge--success">
                <BadgeCheck size={12} /> Phone verified
              </span>
            )}
            <p className="seller-profile__note">A verified phone number confirms the seller can receive codes; it is not an identity check. Meet in a public place and check the item before paying.</p>
          </aside>

          <div>
            {listings.error ? (
              <ErrorState error={listings.error} onRetry={listings.reload} />
            ) : listings.isLoading || !listings.data ? (
              <div className="listing-grid listing-grid--3">
                {Array.from({ length: 6 }, (_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : listings.data.items.length === 0 ? (
              <div className="card">
                <EmptyState icon={<Store size={26} />} title="No live ads right now" text="This seller has no ads on sale at the moment. Check back later." />
              </div>
            ) : (
              <>
                <div className="listing-grid listing-grid--3">
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
        </div>
      </section>
    </>
  );
}
