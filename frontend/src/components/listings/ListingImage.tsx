import { useState } from 'react';
import type { Listing } from '../../types';
import { CategoryIcon } from './CategoryIcon';
import { iconForSlug } from './category-icons';

/** Shows the first photo, or a soft category illustration when the ad has no usable photo */
export function ListingImage({ listing, className, iconSize = 40 }: { listing: Pick<Listing, 'photos' | 'categorySlug' | 'title'>; className?: string; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = [...listing.photos].sort((a, b) => a.position - b.position)[0];

  if (photo && !failed) {
    return <img className={['listing-image', className].filter(Boolean).join(' ')} src={photo.url} alt={listing.title} loading="lazy" onError={() => setFailed(true)} />;
  }

  return (
    <div className={['listing-image', 'listing-image--placeholder', `listing-image--${listing.categorySlug}`, className].filter(Boolean).join(' ')} role="img" aria-label={listing.title}>
      <CategoryIcon icon={iconForSlug(listing.categorySlug)} size={iconSize} strokeWidth={1.5} />
    </div>
  );
}
