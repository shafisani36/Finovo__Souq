import { BadgeCheck, CalendarDays, CheckCircle2, Layers, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SellerSummary, SellerTrust } from '../../types';
import { formatDate, formatNumber } from '../../utils/format';
import { t, tn } from '../../i18n';

const SPEED: Record<NonNullable<SellerTrust['replySpeed']>, string> = {
  within_hour: t('Usually replies within an hour'),
  within_hours: t('Usually replies within a few hours'),
  within_day: t('Usually replies within a day'),
  slow: t('Usually takes more than a day to reply'),
};

/** The seller trust card: what a buyer can check before getting in touch */
export function SellerTrustFacts({ seller }: { seller: SellerSummary }) {
  const trust = seller.trust;
  return (
    <ul className="trust-facts">
      {trust?.business && (
        <li className="trust-facts__business">
          <BadgeCheck size={15} aria-hidden="true" />
          <span>
            {t('Verified business ·')} <Link to={`/stores/${trust.business.slug}`}>{trust.business.name}</Link>
          </span>
        </li>
      )}
      <li>
        <CalendarDays size={15} aria-hidden="true" /> {t('Member since')} {formatDate(seller.memberSince)}
      </li>
      <li>
        <Layers size={15} aria-hidden="true" /> {tn(seller.activeListings, '{count} live ad', '{count} live ads', { count: formatNumber(seller.activeListings) })}
      </li>
      {trust && trust.itemsSold > 0 && (
        <li>
          <CheckCircle2 size={15} aria-hidden="true" /> {tn(trust.itemsSold, '{count} item sold or rented', '{count} items sold or rented', { count: formatNumber(trust.itemsSold) })}
        </li>
      )}
      {trust?.replySpeed && (
        <li>
          <MessageCircle size={15} aria-hidden="true" /> {SPEED[trust.replySpeed]}
          {trust.replyRate !== null && (
            <span className="trust-facts__muted">
              {' '}
              {t('· answers')} {trust.replyRate}
              {t('% of buyers')}
            </span>
          )}
        </li>
      )}
    </ul>
  );
}
