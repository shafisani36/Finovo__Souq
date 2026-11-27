import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';
import { paymentsService } from '../../services/payments.service';
import type { Listing, PromotionPackage } from '../../types';
import { formatDate, formatPrice } from '../../utils/format';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { t } from '../../i18n';

interface PromoteAdModalProps {
  listing: Listing | null;
  packages: PromotionPackage[];
  onClose: () => void;
}

/** Package choice, then a redirect to Stripe's secure payment page */
export function PromoteAdModal({ listing, packages, onClose }: PromoteAdModalProps) {
  const [days, setDays] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const chosen = packages.find((p) => p.days === days) ?? packages[0];

  const pay = async () => {
    if (!listing || !chosen) return;
    setRedirecting(true);
    setError('');
    try {
      window.location.assign(await paymentsService.startPromotion(listing.id, chosen.days));
    } catch (err) {
      setError(getErrorMessage(err));
      setRedirecting(false);
    }
  };

  return (
    <Modal
      open={Boolean(listing)}
      title={listing?.featuredUntil ? t('Extend the promotion') : t('Promote this ad')}
      description={listing?.title}
      onClose={() => {
        if (!redirecting) onClose();
      }}
      footer={
        <>
          <Button onClick={onClose} disabled={redirecting}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" icon={<Lock size={15} />} isLoading={redirecting} onClick={() => void pay()} disabled={!chosen}>
            {chosen ? t('Pay {amount}', { amount: formatPrice(chosen.price) }) : t('Pay')}
          </Button>
        </>
      }
    >
      <p className="text-secondary" style={{ marginTop: 0 }}>
        {t('Featured ads appear first in search and in the Featured section on the home page.')}
        {listing?.featuredUntil &&
          t(' This ad is featured until {featuredUntil}; the new days are added after that.', {
            featuredUntil: formatDate(listing.featuredUntil),
          })}{' '}
        {t('Our team approves each promotion before it starts; if it is not approved, you get a full refund. The invoice is emailed to you.')}
      </p>
      {error && (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      )}
      <div className="promo-packages" role="radiogroup" aria-label={t('Promotion length')}>
        {packages.map((p) => (
          <button key={p.days} type="button" role="radio" aria-checked={chosen?.days === p.days} className="promo-package" onClick={() => setDays(p.days)} disabled={redirecting}>
            <Sparkles size={16} aria-hidden="true" />
            <span className="promo-package__days">
              {p.days} {t('days')}
            </span>
            <strong className="promo-package__price tabular">
              {formatPrice(p.price)}
            </strong>
          </button>
        ))}
      </div>
      <p className="text-muted promo-packages__note">
        <Lock size={13} aria-hidden="true" /> {t("You pay on Stripe's secure page. We never see your card details.")}
      </p>
    </Modal>
  );
}
