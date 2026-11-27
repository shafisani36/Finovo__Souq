import { Heart } from 'lucide-react';
import { useSavedListings } from '../../features/saved/saved-context';
import { t } from '../../i18n';

export function SaveButton({ listingId, className }: { listingId: string; className?: string }) {
  const { isSaved, toggle, pendingIds } = useSavedListings();
  const saved = isSaved(listingId);
  return (
    <button
      type="button"
      className={['icon-btn', 'save-btn', saved && 'save-btn--active', className].filter(Boolean).join(' ')}
      aria-pressed={saved}
      aria-label={saved ? t('Remove from saved ads') : t('Save ad')}
      disabled={pendingIds.has(listingId)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle(listingId);
      }}
    >
      <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
