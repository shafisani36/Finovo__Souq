import { Building2, Fuel, Landmark, ShieldCheck, ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../i18n';

const PLACES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <ShieldCheck size={20} />, title: t('Police station car park'), text: t('The safest choice for cars, phones and other valuable items. Honest people never mind meeting here.') },
  { icon: <ShoppingBag size={20} />, title: t('Busy shopping mall entrance'), text: t('Plenty of people, security staff and cameras. Good for small and medium items.') },
  { icon: <Fuel size={20} />, title: t('Petrol station on a main road'), text: t('Well lit, with cameras and space to park. Good for viewing a car.') },
  { icon: <Landmark size={20} />, title: t('Bank branch during opening hours'), text: t('For large payments: the buyer can transfer or withdraw on the spot after checking the item.') },
];

const CHECKLIST = [
  'Meet in daylight and tell a friend where you are going.',
  'Bring someone with you for cars, property and expensive items.',
  'Check the item fully before any money changes hands.',
  'Never pay a deposit or transfer money before the meeting.',
  "For property, visit the place itself and confirm the owner's documents.",
];

/** Fixed guidance on the Safety page; chat tips link here with /safety#meet */
export function SafeMeetingPlaces() {
  return (
    <section id="meet" className="card meet-places" aria-labelledby="meet-title">
      <h2 id="meet-title" className="card-title">
        <Building2 size={18} aria-hidden="true" /> {t('Safe places to meet')}
      </h2>
      <ul className="meet-places__grid">
        {PLACES.map((place) => (
          <li key={place.title} className="meet-places__place">
            <span className="meet-places__icon" aria-hidden="true">
              {place.icon}
            </span>
            <strong>{place.title}</strong>
            <span>{place.text}</span>
          </li>
        ))}
      </ul>
      <h3 className="meet-places__subtitle">{t('Before you go')}</h3>
      <ul className="meet-places__checklist">
        {CHECKLIST.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
