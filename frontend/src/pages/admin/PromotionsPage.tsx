import { useState, type ReactNode } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { ListingImage } from '../../components/listings/ListingImage';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { Listing } from '../../types';
import { formatDate, formatPrice } from '../../utils/format';

const DAY_OPTIONS = [3, 7, 14, 30].map((d) => ({ value: String(d), label: `${d} days` }));

function AdRow({ listing, children }: { listing: Listing; children: ReactNode }) {
  return (
    <li className="promo-row">
      <div className="promo-row__thumb">
        <ListingImage listing={listing} iconSize={20} />
      </div>
      <div className="promo-row__body">
        <Link to={`/listings/${listing.id}`} className="promo-row__title" target="_blank">
          {listing.title}
        </Link>
        <span className="text-muted">
          {formatPrice(listing.price, listing.listingType)} · {listing.categoryName} · {listing.city} · {listing.seller.name}
        </span>
      </div>
      <div className="promo-row__actions">{children}</div>
    </li>
  );
}

/** Free promotions by the team: featured ads show first in search and on the home page */
export function PromotionsPage() {
  useDocumentTitle('Promotions');
  const toast = useToast();
  const featured = useAsync(() => adminService.promotions(), []);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const results = useAsync(() => (q.length >= 2 ? adminService.moderationQueue({ status: 'published', q, page: 1 }) : Promise.resolve(null)), [q]);
  const [days, setDays] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>, title: string) => {
    setBusyId(id);
    try {
      await action();
      toast.show({ title });
      featured.reload();
      results.reload();
    } catch (error) {
      toast.show({ title: 'Could not save', message: getErrorMessage(error), tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const featureButton = (l: Listing) => (
    <>
      <Select size="sm" value={days[l.id] ?? '7'} onChange={(v) => setDays((d) => ({ ...d, [l.id]: v }))} options={DAY_OPTIONS} aria-label={`Promotion length for ${l.title}`} />
      <Button size="sm" variant="primary" icon={<Sparkles size={14} />} isLoading={busyId === l.id} onClick={() => run(l.id, () => adminService.feature(l.id, Number(days[l.id] ?? '7')), l.featuredUntil ? 'Promotion extended' : 'Ad featured')}>
        {l.featuredUntil ? 'Extend' : 'Feature'}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader title="Promotions" subtitle="Featured ads appear first in search and in a Featured section on the home page. Paid promotions come later, once a payment provider is chosen." />

      <section className="card promo-section">
        <h2 className="card-title">Featured now</h2>
        {featured.error ? (
          <ErrorState error={featured.error} onRetry={featured.reload} />
        ) : featured.isLoading || !featured.data ? (
          <SkeletonBlock height={140} />
        ) : featured.data.length === 0 ? (
          <EmptyState icon={<Sparkles size={26} />} title="No featured ads" text="Find a live ad below and feature it." />
        ) : (
          <ul className="promo-list">
            {featured.data.map((l) => (
              <AdRow key={l.id} listing={l}>
                <span className="promo-row__until">Until {formatDate(l.featuredUntil as string)}</span>
                {featureButton(l)}
                <Button size="sm" icon={<X size={14} />} isLoading={busyId === `stop-${l.id}`} onClick={() => run(`stop-${l.id}`, () => adminService.stopFeature(l.id), 'Promotion stopped')}>
                  Stop
                </Button>
              </AdRow>
            ))}
          </ul>
        )}
      </section>

      <section className="card promo-section">
        <h2 className="card-title">Feature a live ad</h2>
        <div className="toolbar__search promo-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search live ads by title or seller name" aria-label="Search live ads" />
        </div>
        {q.length < 2 ? (
          <p className="text-muted">Type at least 2 letters.</p>
        ) : results.error ? (
          <ErrorState error={results.error} onRetry={results.reload} />
        ) : results.isLoading || !results.data ? (
          <SkeletonBlock height={140} />
        ) : results.data.items.length === 0 ? (
          <p className="text-muted">No live ads match "{q}".</p>
        ) : (
          <ul className="promo-list">
            {results.data.items.map((l) => (
              <AdRow key={l.id} listing={l}>
                {featureButton(l)}
              </AdRow>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
