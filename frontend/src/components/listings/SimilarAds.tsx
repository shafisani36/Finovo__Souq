import { useAsync } from '../../hooks/useAsync';
import { listingsService } from '../../services/listings.service';
import { ListingCard } from './ListingCard';
import { t } from '../../i18n';

/** "You may also like": live ads from the same category, same city first. Hidden when there are none */
export function SimilarAds({ listingId }: { listingId: string }) {
  const similar = useAsync(() => listingsService.similar(listingId), [listingId]);
  if (!similar.data?.length) return null;

  return (
    <section className="similar-ads" aria-labelledby="similar-ads-title">
      <h2 id="similar-ads-title" className="similar-ads__title">
        {t('Similar ads')}
      </h2>
      <div className="listing-grid">
        {similar.data.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
