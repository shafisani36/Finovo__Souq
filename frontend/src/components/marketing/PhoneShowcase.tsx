import { ChevronLeft, Heart, MapPin, MessageSquare, Search, Send } from 'lucide-react';
import type { Category, Listing } from '../../types';
import { formatPrice } from '../../utils/format';
import { CategoryIcon } from '../listings/CategoryIcon';
import { ListingImage } from '../listings/ListingImage';
import { t } from '../../i18n';

function StatusBar() {
  return (
    <div className="phone__status">
      <span>9:41</span>
      <span className="phone__notch" />
      <span className="phone__signal" />
    </div>
  );
}

type ShowcaseAd = Pick<Listing, 'id' | 'title' | 'price' | 'listingType' | 'city' | 'photos' | 'categoryIcon'>;

/** Fills the phones until there are enough live ads, so the hero never looks empty on a new site */
const SAMPLE_ADS: ShowcaseAd[] = [
  { id: 'sample-car', title: t('Toyota Camry 2022, low mileage'), price: 89000, listingType: 'sale', city: 'Riyadh', photos: [], categoryIcon: 'car' },
  { id: 'sample-phone', title: t('iPhone 15 Pro, 256 GB'), price: 3900, listingType: 'sale', city: 'Jeddah', photos: [], categoryIcon: 'phone' },
  { id: 'sample-flat', title: t('2 bedroom apartment'), price: 48000, listingType: 'rent', city: 'Dammam', photos: [], categoryIcon: 'property' },
];

/**
 * Three phone screens drawn from live data: an ad, the home screen and a chat.
 * Decorative only, so it is hidden from screen readers.
 */
export function PhoneShowcase({ listings, categories }: { listings: Listing[]; categories: Category[] }) {
  const [featured, second, third] = [...listings, ...SAMPLE_ADS];

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
            <MapPin size={10} /> {t(featured.city)}
          </p>
          <span className="phone__button">
            <MessageSquare size={11} /> {t('Message seller')}
          </span>
        </div>
      </div>

      <div className="phone phone--main">
        <StatusBar />
        <div className="phone__screen">
          <p className="phone__meta">
            <MapPin size={10} /> {t('Riyadh')}
          </p>
          <p className="phone__hello">{t('What are you looking for?')}</p>
          <div className="phone__search">
            <Search size={11} /> {t('Search cars, phones, flats')}
          </div>
          <p className="phone__label">{t('Categories')}</p>
          <div className="phone__cats">
            {categories
              .filter((c) => c.depth === 0)
              .slice(0, 5)
              .map((c) => (
                <span key={c.id}>
                  <span className="phone__cat-icon">
                    <CategoryIcon icon={c.icon} size={14} />
                  </span>
                  {c.name.split(' ')[0]}
                </span>
              ))}
          </div>
          <p className="phone__label">{t('Fresh ads')}</p>
          <div className="phone__grid">
            {[second, third].map((l) => (
              <div key={l.id} className="phone__card">
                <ListingImage listing={l} iconSize={20} />
                <strong>{formatPrice(l.price, l.listingType)}</strong>
                <span>{l.title}</span>
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
              <strong>{t('Sara')}</strong>
              <span>{featured.title}</span>
            </span>
          </div>
          <div className="phone__bubbles">
            <span className="phone__bubble">{t('Hello, is this still available?')}</span>
            <span className="phone__bubble phone__bubble--me">{t('Yes it is. You can see it this week.')}</span>
            <span className="phone__bubble">{t('Great, Thursday evening works for me.')}</span>
            <span className="phone__bubble phone__bubble--me">{t('See you then.')}</span>
          </div>
          <div className="phone__composer">
            {t('Write a message')}
            <Send size={11} />
          </div>
        </div>
      </div>
    </div>
  );
}
