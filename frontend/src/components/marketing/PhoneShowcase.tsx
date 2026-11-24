import { ChevronLeft, Heart, MapPin, MessageSquare, Search, Send } from 'lucide-react';
import type { Category, Listing } from '../../types';
import { formatPrice } from '../../utils/format';
import { CategoryIcon } from '../listings/CategoryIcon';
import { ListingImage } from '../listings/ListingImage';

function StatusBar() {
  return (
    <div className="phone__status">
      <span>9:41</span>
      <span className="phone__notch" />
      <span className="phone__signal" />
    </div>
  );
}

/**
 * Three phone screens drawn from live data: an ad, the home screen and a chat.
 * Decorative only, so it is hidden from screen readers.
 */
export function PhoneShowcase({ listings, categories }: { listings: Listing[]; categories: Category[] }) {
  const [featured, second, third] = listings;
  if (!featured) return <div className="phones phones--empty" aria-hidden="true" />;

  return (
    <div className="phones" aria-hidden="true">
      <div className="phone phone--side">
        <StatusBar />
        <div className="phone__screen">
          <div className="phone__bar">
            <ChevronLeft size={14} />
            <Heart size={13} />
          </div>
          <div className="phone__photo">
            <ListingImage listing={featured} iconSize={42} />
          </div>
          <p className="phone__price">{formatPrice(featured.price, featured.listingType)}</p>
          <p className="phone__title">{featured.title}</p>
          <p className="phone__meta">
            <MapPin size={10} /> {featured.city}
          </p>
          <span className="phone__button">
            <MessageSquare size={11} /> Message seller
          </span>
        </div>
      </div>

      <div className="phone phone--main">
        <StatusBar />
        <div className="phone__screen">
          <p className="phone__meta">
            <MapPin size={10} /> Riyadh
          </p>
          <p className="phone__hello">What are you looking for?</p>
          <div className="phone__search">
            <Search size={11} /> Search cars, phones, flats
          </div>
          <p className="phone__label">Categories</p>
          <div className="phone__cats">
            {categories.slice(0, 5).map((c) => (
              <span key={c.id}>
                <span className="phone__cat-icon">
                  <CategoryIcon icon={c.icon} size={14} />
                </span>
                {c.name.split(' ')[0]}
              </span>
            ))}
          </div>
          <p className="phone__label">Fresh ads</p>
          <div className="phone__grid">
            {[second, third].filter(Boolean).map((l) => (
              <div key={l!.id} className="phone__card">
                <ListingImage listing={l!} iconSize={20} />
                <strong>{formatPrice(l!.price, l!.listingType)}</strong>
                <span>{l!.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="phone phone--side">
        <StatusBar />
        <div className="phone__screen">
          <div className="phone__chat-head">
            <span className="phone__avatar">SA</span>
            <span>
              <strong>Sara</strong>
              <span>{featured.title}</span>
            </span>
          </div>
          <div className="phone__bubbles">
            <span className="phone__bubble">Hello, is this still available?</span>
            <span className="phone__bubble phone__bubble--me">Yes it is. You can see it this week.</span>
            <span className="phone__bubble">Great, Thursday evening works for me.</span>
            <span className="phone__bubble phone__bubble--me">See you then.</span>
          </div>
          <div className="phone__composer">
            Write a message
            <Send size={11} />
          </div>
        </div>
      </div>
    </div>
  );
}
