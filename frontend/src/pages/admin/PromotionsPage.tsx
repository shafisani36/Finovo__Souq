import { useState, type ReactNode } from 'react';
import { Check, CreditCard, Search, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { ListingImage } from '../../components/listings/ListingImage';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextareaField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { Listing, Payment, PaymentStatus } from '../../types';
import { formatDate, formatPrice } from '../../utils/format';
import { t, tn } from '../../i18n';

const DAY_OPTIONS = [3, 7, 14, 30].map((d) => ({ value: String(d), label: tn(d, '{count} day', '{count} days') }));

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
          {formatPrice(listing.price, listing.listingType)} · {listing.categoryName} · {t(listing.city)} · {listing.seller.name}
        </span>
      </div>
      <div className="promo-row__actions">{children}</div>
    </li>
  );
}

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: t('Waiting for approval'), tone: 'warning' },
  approved: { label: t('Approved'), tone: 'success' },
  refunded: { label: t('Refunded'), tone: 'neutral' },
  failed: { label: t('Failed'), tone: 'danger' },
  expired: { label: t('Not completed'), tone: 'neutral' },
  pending: { label: t('In checkout'), tone: 'info' },
};

/** Paid promotions an admin must approve (ad gets featured) or reject (seller is refunded) */
function ApprovalQueue({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const queue = useAsync(() => adminService.payments({ status: 'paid', page: 1 }), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const done = (title: string, message: string) => {
    toast.show({ title, message });
    queue.reload();
    onChange();
  };

  const approve = async (payment: Payment) => {
    setBusyId(payment.id);
    try {
      const result = await adminService.approvePayment(payment.id);
      done(
        'Promotion approved',
        t('Featured until {featuredUntil}.', {
          featuredUntil: formatDate(result.featuredUntil as string),
        }),
      );
    } catch (error) {
      toast.show({ title: t('Could not approve'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) {
      setReasonError(t('Tell the seller why, in a few words.'));
      return;
    }
    setBusyId(rejecting.id);
    try {
      await adminService.rejectPayment(rejecting.id, reason.trim());
      setRejecting(null);
      done('Promotion rejected', t('{amount} refunded to the seller.', { amount: formatPrice(rejecting.amount) }));
    } catch (error) {
      setReasonError(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  if (queue.error) return <ErrorState error={queue.error} onRetry={queue.reload} />;
  if (!queue.data || queue.data.items.length === 0) return null;

  return (
    <section className="card promo-section">
      <h2 className="card-title">{t('Paid, waiting for approval ({count})', { count: queue.data.total })}</h2>
      <p className="card-subtitle">{t('The seller has paid. Approve to feature the ad from now, or reject to refund the full amount.')}</p>
      <ul className="promo-list">
        {queue.data.items.map((p) => (
          <li key={p.id} className="promo-row">
            <div className="promo-row__body">
              {p.listingId ? (
                <Link to={`/listings/${p.listingId}`} className="promo-row__title" target="_blank">
                  {p.listingTitle ?? t('Ad')}
                </Link>
              ) : (
                <span className="promo-row__title">{t('Removed ad')}</span>
              )}
              <span className="text-muted">
                {t('{name} · {days} days · {amount} · {invoice} · paid {date}', {
                  name: p.user?.name ?? t('Former member'),
                  days: p.days,
                  amount: formatPrice(p.amount),
                  invoice: p.invoiceNumber,
                  date: formatDate(p.paidAt as string),
                })}
              </span>
              {p.note && <span className="text-muted">{p.note}</span>}
            </div>
            <div className="promo-row__actions">
              <Button size="sm" variant="success" icon={<Check size={14} />} isLoading={busyId === p.id && !rejecting} disabled={Boolean(busyId)} onClick={() => void approve(p)}>
                {t('Approve')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<X size={14} />}
                disabled={Boolean(busyId)}
                onClick={() => {
                  setRejecting(p);
                  setReason('');
                  setReasonError('');
                }}
              >
                {t('Reject and refund')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(rejecting)}
        title={t('Reject and refund?')}
        description={
          rejecting
            ? t("{amount} goes back to {name}'s card. The ad stays live, just not featured.", {
                amount: formatPrice(rejecting.amount),
                name: rejecting.user?.name ?? t('the seller'),
              })
            : ''
        }
        onClose={() => setRejecting(null)}
        footer={
          <>
            <Button onClick={() => setRejecting(null)}>{t('Cancel')}</Button>
            <Button variant="danger" isLoading={busyId === rejecting?.id} onClick={() => void reject()}>
              {t('Reject and refund')}
            </Button>
          </>
        }
      >
        <TextareaField
          label={t('Reason for the seller')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError('');
          }}
          error={reasonError}
          maxLength={300}
          required
          placeholder={t('e.g. The photos do not meet our promotion guidelines.')}
        />
      </Modal>
    </section>
  );
}

/** Seller payments for promotions, newest first */
function PaymentsSection({ version }: { version: number }) {
  const [page, setPage] = useState(1);
  const payments = useAsync(() => adminService.payments({ page }), [page, version]);
  return (
    <section className="card promo-section">
      <h2 className="card-title">{t('Seller payments')}</h2>
      {payments.error ? (
        <ErrorState error={payments.error} onRetry={payments.reload} />
      ) : payments.isLoading || !payments.data ? (
        <SkeletonBlock height={140} />
      ) : payments.data.items.length === 0 ? (
        <EmptyState icon={<CreditCard size={26} />} title={t('No payments yet')} text={t('Promotions bought by sellers with a card appear here.')} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Ad')}</th>
                  <th>{t('Seller')}</th>
                  <th>{t('Invoice')}</th>
                  <th>{t('Package')}</th>
                  <th className="table__num">{t('Amount')}</th>
                  <th>{t('Status')}</th>
                  <th className="table__num">{t('Date')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="table-item__title">
                        {p.listingId ? (
                          <Link to={`/listings/${p.listingId}`} target="_blank">
                            {p.listingTitle ?? t('Ad')}
                          </Link>
                        ) : (
                          t('Removed ad')
                        )}
                      </span>
                      {p.note && <span className="table-item__meta">{p.note}</span>}
                    </td>
                    <td>
                      <span className="table-item__title">{p.user?.name ?? t('Former member')}</span>
                      {p.user && <span className="table-item__meta">{p.user.email}</span>}
                    </td>
                    <td className="tabular">{p.invoiceNumber ?? '-'}</td>
                    <td>
                      {p.days} {t('days')}
                    </td>
                    <td className="table__num tabular">{formatPrice(p.amount)}</td>
                    <td>
                      <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                    </td>
                    <td className="table__num">{formatDate(p.paidAt ?? p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={payments.data.page} totalPages={payments.data.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}

/** Featured ads show first in search and on the home page; sellers buy them, and the team can feature any ad for free */
export function PromotionsPage() {
  useDocumentTitle(t('Promotions'));
  const toast = useToast();
  const featured = useAsync(() => adminService.promotions(), []);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const results = useAsync(() => (q.length >= 2 ? adminService.moderationQueue({ status: 'published', q, page: 1 }) : Promise.resolve(null)), [q]);
  const [days, setDays] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentsVersion, setPaymentsVersion] = useState(0);

  const run = async (id: string, action: () => Promise<unknown>, title: string) => {
    setBusyId(id);
    try {
      await action();
      toast.show({ title });
      featured.reload();
      results.reload();
    } catch (error) {
      toast.show({ title: t('Could not save'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const featureButton = (l: Listing) => (
    <>
      <Select
        size="sm"
        value={days[l.id] ?? '7'}
        onChange={(v) => setDays((d) => ({ ...d, [l.id]: v }))}
        options={DAY_OPTIONS}
        aria-label={t('Promotion length for {title}', {
          title: l.title,
        })}
      />
      <Button
        size="sm"
        variant="primary"
        icon={<Sparkles size={14} />}
        isLoading={busyId === l.id}
        onClick={() => run(l.id, () => adminService.feature(l.id, Number(days[l.id] ?? '7')), l.featuredUntil ? 'Promotion extended' : 'Ad featured')}
      >
        {l.featuredUntil ? t('Extend') : t('Feature')}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        title={t('Promotions')}
        subtitle={t(
          'Featured ads appear first in search and in a Featured section on the home page. Sellers pay by card and you approve each paid promotion; you can also feature any ad for free. Prices are under Settings → Paid promotion.',
        )}
      />

      <ApprovalQueue
        onChange={() => {
          featured.reload();
          setPaymentsVersion((v) => v + 1);
        }}
      />

      <section className="card promo-section">
        <h2 className="card-title">{t('Featured now')}</h2>
        {featured.error ? (
          <ErrorState error={featured.error} onRetry={featured.reload} />
        ) : featured.isLoading || !featured.data ? (
          <SkeletonBlock height={140} />
        ) : featured.data.length === 0 ? (
          <EmptyState icon={<Sparkles size={26} />} title={t('No featured ads')} text={t('Find a live ad below and feature it.')} />
        ) : (
          <ul className="promo-list">
            {featured.data.map((l) => (
              <AdRow key={l.id} listing={l}>
                <span className="promo-row__until">
                  {t('Until')} {formatDate(l.featuredUntil as string)}
                </span>
                {featureButton(l)}
                <Button size="sm" icon={<X size={14} />} isLoading={busyId === `stop-${l.id}`} onClick={() => run(`stop-${l.id}`, () => adminService.stopFeature(l.id), 'Promotion stopped')}>
                  {t('Stop')}
                </Button>
              </AdRow>
            ))}
          </ul>
        )}
      </section>

      <section className="card promo-section">
        <h2 className="card-title">{t('Feature a live ad')}</h2>
        <div className="toolbar__search promo-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search live ads by title or seller name')} aria-label={t('Search live ads')} />
        </div>
        {q.length < 2 ? (
          <p className="text-muted">{t('Type at least 2 letters.')}</p>
        ) : results.error ? (
          <ErrorState error={results.error} onRetry={results.reload} />
        ) : results.isLoading || !results.data ? (
          <SkeletonBlock height={140} />
        ) : results.data.items.length === 0 ? (
          <p className="text-muted">
            {t('No live ads match "')}
            {q}".
          </p>
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

      <PaymentsSection version={paymentsVersion} />
    </>
  );
}
