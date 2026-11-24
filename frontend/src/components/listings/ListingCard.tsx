import { CalendarDays, Gauge, BedDouble, MapPin, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Listing } from '../../types';
import { formatNumber, formatPrice, formatRelative, LISTING_TYPE_LABELS } from '../../utils/format';
import { ListingImage } from './ListingImage';
import { SaveButton } from './SaveButton';

function KeyFacts({ listing }: { listing: Listing }) {
  const a = listing.attributes;
  if (listing.categorySlug === 'cars') {
    return (
      <>
        <span><CalendarDays size={14} />{a.year}</span>
        <span><Gauge size={14} />{formatNumber(Number(a.mileage))} km</span>
      </>
    );
  }
  if (listing.categorySlug === 'property') {
    return (
      <>
        {Number(a.bedrooms) > 0 && <span><BedDouble size={14} />{a.bedrooms} {Number(a.bedrooms) === 1 ? 'bed' : 'beds'}</span>}
        <span><Ruler size={14} />{formatNumber(Number(a.area))} m²</span>
      </>
    );
  }
  const detail = a.condition ?? a.serviceCategory ?? a.itemType;
  return detail ? <span>{detail}</span> : null;
}

export function ListingCard({ listing, showSave = true }: { listing: Listing; showSave?: boolean }) {
  return (
    <article className="listing-card">
      <Link to={`/listings/${listing.id}`} className="listing-card__link" aria-label={listing.title} />
      <div className="listing-card__media">
        <ListingImage listing={listing} />
        <span className="listing-card__type">{LISTING_TYPE_LABELS[listing.listingType]}</span>
        {showSave && <SaveButton listingId={listing.id} className="listing-card__save" />}
      </div>
      <div className="listing-card__body">
        <p className="listing-card__price tabular">{formatPrice(listing.price, listing.listingType)}</p>
        <h3 className="listing-card__title">{listing.title}</h3>
        <div className="listing-card__facts">
          <KeyFacts listing={listing} />
        </div>
        <div className="listing-card__footer">
          <span>
            <MapPin size={14} />
            {listing.city}
          </span>
          <span>{formatRelative(listing.publishedAt ?? listing.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card listing-card--skeleton" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 16 }} />
      <div className="listing-card__body">
        <div className="skeleton" style={{ height: 20, width: '50%' }} />
        <div className="skeleton" style={{ height: 14, width: '90%' }} />
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
    </div>
  );
}
