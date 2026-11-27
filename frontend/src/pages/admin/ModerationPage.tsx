import { useState, type FormEvent } from 'react';
import { CheckCircle2, EyeOff, FileEdit, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { ListingImage } from '../../components/listings/ListingImage';
import { ListingStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextareaField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import { categoriesService } from '../../services/categories.service';
import { listingsService } from '../../services/listings.service';
import type { Listing, ListingStatus } from '../../types';
import { formatDate, formatNumber, formatPrice, formatRelative, LISTING_TYPE_LABELS } from '../../utils/format';
import { t } from '../../i18n';

const STATUS_TABS: { value: ListingStatus | 'all'; label: string }[] = [
  { value: 'pending_review', label: t('Pending') },
  { value: 'changes_required', label: t('Changes required') },
  { value: 'published', label: t('Live') },
  { value: 'hidden', label: t('Hidden') },
  { value: 'rejected', label: t('Rejected') },
  { value: 'all', label: t('All') },
];

type DecisionMode = 'changes' | 'reject' | 'hide';

const DECISION_COPY: Record<DecisionMode, { title: string; button: string; help: string }> = {
  changes: { title: t('Request changes'), button: 'Send to seller', help: t('Tell the seller exactly what to fix. They can edit and resubmit.') },
  reject: { title: t('Reject ad'), button: 'Reject ad', help: t('The ad will not be published. Explain why so the seller understands.') },
  hide: { title: t('Hide ad'), button: 'Hide ad', help: t('The ad is removed from public view immediately. The reason is recorded in moderation history.') },
};

function ReviewPanel({ listing, onDone }: { listing: Listing; onDone: (updated: Listing) => void }) {
  const toast = useToast();
  const categories = useAsync(() => categoriesService.list(), []);
  const [mode, setMode] = useState<DecisionMode | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const category = categories.data?.find((c) => c.id === listing.categoryId);

  const run = async (key: string, action: () => Promise<Listing>, successTitle: string) => {
    setBusy(key);
    setError('');
    try {
      const updated = await action();
      toast.show({ title: successTitle });
      onDone(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const submitDecision = (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    if (reason.trim().length < 10) {
      setError(t('Explain the reason in at least 10 characters.'));
      return;
    }
    if (mode === 'hide') void run('hide', () => adminService.hide(listing.id, reason.trim()), 'Ad hidden');
    else void run(mode, () => adminService.reject(listing.id, reason.trim(), mode), mode === 'changes' ? 'Changes requested' : 'Ad rejected');
  };

  const isPending = listing.status === 'pending_review';
  const canHide = listing.status !== 'hidden';

  return (
    <div className="review">
      <div className="review__media">
        <ListingImage listing={listing} iconSize={64} />
      </div>
      <div className="review__head">
        <ListingStatusBadge status={listing.status} availability={listing.availability} />
        <span className="text-muted">
          {listing.categoryTrail.map((c) => c.name).join(' › ')} - {LISTING_TYPE_LABELS[listing.listingType]}
        </span>
      </div>
      <p className="detail__price tabular">{formatPrice(listing.price, listing.listingType)}</p>
      <dl className="spec-grid spec-grid--compact">
        <div>
          <dt>{t('Seller')}</dt>
          <dd>{listing.seller.name}</dd>
        </div>
        <div>
          <dt>{t('Location')}</dt>
          <dd>
            {listing.district}, {t(listing.city)}
          </dd>
        </div>
        <div>
          <dt>{t('Submitted')}</dt>
          <dd>{formatDate(listing.updatedAt)}</dd>
        </div>
        <div>
          <dt>{t('Photos')}</dt>
          <dd>{listing.photos.length}</dd>
        </div>
        {category?.fields.map((f) =>
          listing.attributes[f.fieldKey] !== undefined ? (
            <div key={f.fieldKey}>
              <dt>{f.label}</dt>
              <dd>
                {f.inputType === 'number' && f.fieldKey !== 'year' ? formatNumber(Number(listing.attributes[f.fieldKey])) : t(String(listing.attributes[f.fieldKey]))}
                {f.unit ? ` ${f.unit}` : ''}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      <div className="review__description">
        <h3 className="field__label">{t('Description')}</h3>
        <p>{listing.description}</p>
      </div>
      {listing.moderationNote && (
        <div className="alert alert--warning">
          <FileEdit size={16} />
          <span>
            {t('Previous note:')} {listing.moderationNote}
          </span>
        </div>
      )}
      {error && (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      )}

      {mode ? (
        <form className="review__decision" onSubmit={submitDecision}>
          <TextareaField
            label={t('{title}: reason', {
              title: DECISION_COPY[mode].title,
            })}
            hint={DECISION_COPY[mode].help}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            maxLength={500}
            required
            autoFocus
          />
          <div className="review__actions">
            <Button
              onClick={() => {
                setMode(null);
                setReason('');
                setError('');
              }}
            >
              {t('Back')}
            </Button>
            <Button type="submit" variant={mode === 'changes' ? 'primary' : 'danger'} isLoading={busy === mode}>
              {DECISION_COPY[mode].button}
            </Button>
          </div>
        </form>
      ) : (
        <div className="review__actions">
          {isPending && (
            <>
              <Button variant="success" icon={<CheckCircle2 size={16} />} isLoading={busy === 'approve'} onClick={() => run('approve', () => adminService.approve(listing.id), 'Ad approved and live')}>
                {t('Approve')}
              </Button>
              <Button icon={<FileEdit size={16} />} onClick={() => setMode('changes')}>
                {t('Request changes')}
              </Button>
              <Button variant="danger" icon={<XCircle size={16} />} onClick={() => setMode('reject')}>
                {t('Reject')}
              </Button>
            </>
          )}
          {canHide && (
            <Button variant="danger" icon={<EyeOff size={16} />} onClick={() => setMode('hide')}>
              {t('Hide')}
            </Button>
          )}
          <Link to={`/listings/${listing.id}`} className="btn btn--ghost" target="_blank" rel="noopener">
            {t('Open ad page')}
          </Link>
        </div>
      )}
    </div>
  );
}

function QuerySearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="toolbar__search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
    >
      <Search size={16} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('Search title or seller')} aria-label={t('Search ads')} />
    </form>
  );
}

export function ModerationPage() {
  useDocumentTitle(t('Moderation'));
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'pending_review';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const reviewId = searchParams.get('review');

  const queue = useAsync(() => adminService.moderationQueue({ status, q: q || undefined, page }), [status, q, page]);
  const review = useAsync(() => (reviewId ? listingsService.getById(reviewId) : Promise.resolve(null)), [reviewId]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSearchParams(next);
  };

  const closeReview = () => update({ review: null });

  return (
    <>
      <PageHeader title={t('Moderation')} subtitle={t('Only approved ads appear in public search. Every decision is recorded with your name and reason.')} />

      <section className="card">
        <div className="toolbar">
          <div className="segmented segmented--scroll" role="tablist" aria-label={t('Status')}>
            {STATUS_TABS.map((tab) => (
              <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className="segmented__item" onClick={() => update({ status: tab.value, page: null })}>
                {tab.label}
              </button>
            ))}
          </div>
          <QuerySearch key={q} initial={q} onSearch={(value) => update({ q: value || null, page: null })} />
        </div>

        {queue.error ? (
          <ErrorState error={queue.error} onRetry={queue.reload} />
        ) : queue.isLoading || !queue.data ? (
          <SkeletonBlock height={320} />
        ) : queue.data.items.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={26} />} title={t('Nothing here')} text={status === 'pending_review' ? t('No ads are waiting for review.') : t('No ads match these filters.')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Ad')}</th>
                    <th>{t('Seller')}</th>
                    <th>{t('Status')}</th>
                    <th className="table__num">{t('Price')}</th>
                    <th className="table__num">{t('Updated')}</th>
                    <th className="table__num">
                      <span className="sr-only">{t('Actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.items.map((listing) => (
                    <tr key={listing.id}>
                      <td>
                        <div className="table-item">
                          <span className="table-item__thumb">
                            <ListingImage listing={listing} iconSize={20} />
                          </span>
                          <span>
                            <span className="table-item__title">{listing.title}</span>
                            <span className="table-item__meta">
                              {listing.categoryName} - {t(listing.city)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>{listing.seller.name}</td>
                      <td>
                        <ListingStatusBadge status={listing.status} availability={listing.availability} />
                      </td>
                      <td className="table__num">{formatPrice(listing.price, listing.listingType)}</td>
                      <td className="table__num">{formatRelative(listing.updatedAt)}</td>
                      <td>
                        <div className="table__actions">
                          <Button size="sm" variant={listing.status === 'pending_review' ? 'primary' : 'default'} onClick={() => update({ review: listing.id })}>
                            {listing.status === 'pending_review' ? t('Review') : t('View')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={queue.data.page} totalPages={queue.data.totalPages} onChange={(p) => update({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>

      <Modal open={Boolean(reviewId)} title={review.data?.title ?? t('Review ad')} onClose={closeReview} maxWidth={680}>
        {review.isLoading ? (
          <LoadingState label={t('Loading ad...')} />
        ) : review.error || !review.data ? (
          <ErrorState error={review.error} onRetry={review.reload} />
        ) : (
          <ReviewPanel
            listing={review.data}
            onDone={() => {
              closeReview();
              void queue.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
