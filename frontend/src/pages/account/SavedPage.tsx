import { useState } from 'react';
import { Heart, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { ListingCard, ListingCardSkeleton } from '../../components/listings/ListingCard';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useSavedListings } from '../../features/saved/saved-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { savedService } from '../../services/saved.service';
import { formatRelative } from '../../utils/format';
import { savedSearchLink } from '../../utils/search';

export function SavedPage() {
  useDocumentTitle('Saved');
  const toast = useToast();
  const [tab, setTab] = useState<'ads' | 'searches'>('ads');
  const { isSaved } = useSavedListings();
  const listings = useAsync(() => savedService.listListings(), []);
  const searches = useAsync(() => savedService.listSearches(), []);
  const [removing, setRemoving] = useState<string | null>(null);

  // Hearts toggled on this page hide the card straight away
  const visibleListings = listings.data?.filter((l) => isSaved(l.id)) ?? [];

  const removeSearch = async (id: string) => {
    setRemoving(id);
    try {
      await savedService.removeSearch(id);
      searches.setData((prev) => prev?.filter((s) => s.id !== id) ?? null);
      toast.show({ title: 'Saved search removed' });
    } catch (error) {
      toast.show({ title: 'Could not remove search', message: getErrorMessage(error), tone: 'error' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <PageHeader title="Saved" subtitle="Ads and searches you saved for later." />
      <div className="segmented" role="tablist" aria-label="Saved items" style={{ marginBottom: 'var(--space-6)' }}>
        <button type="button" role="tab" aria-selected={tab === 'ads'} className="segmented__item" onClick={() => setTab('ads')}>
          <Heart size={15} /> Saved ads {listings.data ? `(${visibleListings.length})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'searches'} className="segmented__item" onClick={() => setTab('searches')}>
          <Search size={15} /> Saved searches {searches.data ? `(${searches.data.length})` : ''}
        </button>
      </div>

      {tab === 'ads' &&
        (listings.error ? (
          <ErrorState error={listings.error} onRetry={listings.reload} />
        ) : listings.isLoading ? (
          <div className="listing-grid listing-grid--3">
            {Array.from({ length: 3 }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : visibleListings.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Heart size={26} />} title="No saved ads" text="Tap the heart on any ad to save it here." action={<ButtonLink to="/search" variant="primary">Browse ads</ButtonLink>} />
          </div>
        ) : (
          <div className="listing-grid listing-grid--3">
            {visibleListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ))}

      {tab === 'searches' && (
        <section className="card">
          {searches.error ? (
            <ErrorState error={searches.error} onRetry={searches.reload} />
          ) : searches.isLoading || !searches.data ? (
            <SkeletonBlock height={160} />
          ) : searches.data.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title="No saved searches" text="Run a search with filters, then choose Save search." action={<ButtonLink to="/search">Start searching</ButtonLink>} />
          ) : (
            <ul className="saved-searches">
              {searches.data.map((s) => (
                <li key={s.id}>
                  <Link to={savedSearchLink(s)} className="saved-searches__link">
                    <span className="saved-searches__icon">
                      <Search size={16} />
                    </span>
                    <span>
                      <strong>{s.label}</strong>
                      <span className="text-muted">Saved {formatRelative(s.createdAt)}</span>
                    </span>
                  </Link>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label={`Delete saved search ${s.label}`} disabled={removing === s.id} onClick={() => removeSearch(s.id)}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            Email and SMS alerts for new matching ads are planned for a later release.
          </p>
        </section>
      )}
    </>
  );
}
