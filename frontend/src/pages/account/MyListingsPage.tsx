import { useState, type ReactNode } from 'react';
import { CheckCircle2, Eye, Hourglass, MoreHorizontal, Pencil, PlusCircle, RefreshCw, RotateCcw, Send, Undo2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { ListingImage } from '../../components/listings/ListingImage';
import { ListingStatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { listingsService } from '../../services/listings.service';
import type { Listing, ListingStatus } from '../../types';
import { formatDate, formatNumber, formatPrice, formatRelative } from '../../utils/format';

const TABS: { value: ListingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Live' },
  { value: 'pending_review', label: 'In review' },
  { value: 'changes_required', label: 'Needs changes' },
  { value: 'draft', label: 'Drafts' },
  { value: 'expired', label: 'Expired' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const RENEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Same rule as the server: expired ads, or live ads in their last three days */
const canRenew = (l: Listing) => l.status === 'expired' || (l.status === 'published' && l.expiresAt !== null && new Date(l.expiresAt).getTime() - Date.now() <= RENEW_WINDOW_MS);

type PendingAction = { type: 'withdraw' | 'sold' | 'rented' | 'available' | 'submit' | 'renew'; listing: Listing };

const CONFIRM_COPY: Record<PendingAction['type'], { title: string; text: string; button: string }> = {
  withdraw: { title: 'Withdraw this ad?', text: 'It will be removed from search. Buyers who saved it will no longer see it.', button: 'Withdraw ad' },
  sold: { title: 'Mark as sold?', text: 'The ad leaves search results and is shown as sold to anyone with the link.', button: 'Mark as sold' },
  rented: { title: 'Mark as rented?', text: 'The ad leaves search results and is shown as rented to anyone with the link.', button: 'Mark as rented' },
  available: { title: 'Make available again?', text: 'The ad goes back into search results.', button: 'Make available' },
  submit: { title: 'Submit for review?', text: 'Our team will review the ad. You will get a notification when it is live.', button: 'Submit ad' },
  renew: { title: 'Renew this ad?', text: 'It goes back online right away for another full period. Nothing in the ad changes, so no new review is needed.', button: 'Renew ad' },
};

const SUCCESS_TITLE: Record<PendingAction['type'], string> = {
  withdraw: 'Ad withdrawn',
  sold: 'Marked as sold',
  rented: 'Marked as rented',
  available: 'Ad is available again',
  submit: 'Sent for review',
  renew: 'Ad renewed',
};

export function MyListingsPage() {
  useDocumentTitle('My ads');
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'all';
  const page = Number(searchParams.get('page')) || 1;
  const listings = useAsync(() => listingsService.mine({ status, page }), [status, page]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const runAction = async () => {
    if (!pending) return;
    const { type, listing } = pending;
    setWorking(true);
    try {
      if (type === 'withdraw') await listingsService.withdraw(listing.id);
      else if (type === 'submit') await listingsService.submit(listing.id);
      else if (type === 'renew') await listingsService.renew(listing.id);
      else await listingsService.setAvailability(listing.id, type);
      toast.show({ title: SUCCESS_TITLE[type], message: listing.title });
      setPending(null);
      void listings.refresh();
    } catch (error) {
      toast.show({ title: 'Could not update the ad', message: getErrorMessage(error), tone: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const actionsFor = (l: Listing) => {
    const items: { key: string; label: string; icon: ReactNode; onClick: () => void }[] = [];
    if (['draft', 'changes_required', 'published', 'pending_review'].includes(l.status) && l.availability === 'available') {
      items.push({ key: 'edit', label: 'Edit', icon: <Pencil size={15} />, onClick: () => undefined });
    }
    if (l.status === 'published' && canRenew(l)) items.push({ key: 'renew', label: 'Renew now', icon: <RefreshCw size={15} />, onClick: () => setPending({ type: 'renew', listing: l }) });
    if (l.status === 'draft' || l.status === 'changes_required') items.push({ key: 'submit', label: 'Submit for review', icon: <Send size={15} />, onClick: () => setPending({ type: 'submit', listing: l }) });
    if (l.status === 'published' && l.availability === 'available') {
      items.push({ key: 'sold', label: l.listingType === 'rent' ? 'Mark as rented' : 'Mark as sold', icon: <CheckCircle2 size={15} />, onClick: () => setPending({ type: l.listingType === 'rent' ? 'rented' : 'sold', listing: l }) });
    }
    if (l.status === 'published' && l.availability !== 'available') items.push({ key: 'available', label: 'Make available', icon: <RotateCcw size={15} />, onClick: () => setPending({ type: 'available', listing: l }) });
    if (!['withdrawn', 'hidden', 'rejected'].includes(l.status)) items.push({ key: 'withdraw', label: 'Withdraw', icon: <Undo2 size={15} />, onClick: () => setPending({ type: 'withdraw', listing: l }) });
    return items;
  };

  return (
    <>
      <PageHeader
        title="My ads"
        subtitle="Manage, edit and track the review status of your ads."
        actions={
          <ButtonLink to="/account/listings/new" variant="primary" icon={<PlusCircle size={17} />}>
            Post an ad
          </ButtonLink>
        }
      />
      <section className="card">
        <div className="toolbar">
          <div className="segmented segmented--scroll" role="tablist" aria-label="Status">
            {TABS.map((tab) => (
              <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className="segmented__item" onClick={() => setSearchParams(tab.value === 'all' ? {} : { status: tab.value })}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {listings.error ? (
          <ErrorState error={listings.error} onRetry={listings.reload} />
        ) : listings.isLoading || !listings.data ? (
          <SkeletonBlock height={320} />
        ) : listings.data.items.length === 0 ? (
          <EmptyState
            title={status === 'all' ? 'You have no ads yet' : 'No ads with this status'}
            text="Ads you post appear here with their review status."
            action={
              <ButtonLink to="/account/listings/new" variant="primary" icon={<PlusCircle size={16} />}>
                Post an ad
              </ButtonLink>
            }
          />
        ) : (
          <>
            <ul className="my-listings">
              {listings.data.items.map((l) => {
                const actions = actionsFor(l);
                return (
                  <li key={l.id} className="my-listing">
                    <div className="my-listing__thumb">
                      <ListingImage listing={l} iconSize={28} />
                    </div>
                    <div className="my-listing__body">
                      <div className="my-listing__top">
                        <ListingStatusBadge status={l.status} availability={l.availability} />
                        {l.status === 'published' && l.expiresAt ? (
                          <span className={canRenew(l) ? 'my-listing__expiry is-soon' : 'text-muted'}>
                            {canRenew(l) && <Hourglass size={13} />} Live until {formatDate(l.expiresAt)}
                          </span>
                        ) : (
                          <span className="text-muted">Updated {formatRelative(l.updatedAt)}</span>
                        )}
                      </div>
                      <h3 className="my-listing__title">{l.title}</h3>
                      <p className="my-listing__meta">
                        <strong className="tabular">{formatPrice(l.price, l.listingType)}</strong>
                        <span>{l.categoryName}</span>
                        <span>{l.city}</span>
                        <span className="tabular">
                          <Eye size={13} /> {formatNumber(l.views)}
                        </span>
                      </p>
                      {l.moderationNote && (l.status === 'changes_required' || l.status === 'rejected' || l.status === 'hidden') && (
                        <p className={`my-listing__note${l.status === 'changes_required' ? '' : ' my-listing__note--danger'}`}>
                          <strong>Moderator:</strong> {l.moderationNote}
                        </p>
                      )}
                    </div>
                    <div className="my-listing__actions">
                      {l.status === 'changes_required' ? (
                        <ButtonLink to={`/account/listings/${l.id}/edit`} size="sm" variant="primary" icon={<Pencil size={14} />}>
                          Fix and resubmit
                        </ButtonLink>
                      ) : l.status === 'expired' ? (
                        <Button size="sm" variant="primary" icon={<RefreshCw size={14} />} onClick={() => setPending({ type: 'renew', listing: l })}>
                          Renew
                        </Button>
                      ) : (
                        <ButtonLink to={`/listings/${l.id}`} size="sm" icon={<Eye size={14} />}>
                          View
                        </ButtonLink>
                      )}
                      {actions.length > 0 && (
                        <div className="dropdown">
                          <button type="button" className="icon-btn icon-btn--sm" aria-label={`More actions for ${l.title}`} aria-expanded={menuFor === l.id} onClick={() => setMenuFor(menuFor === l.id ? null : l.id)}>
                            <MoreHorizontal size={16} />
                          </button>
                          {menuFor === l.id && (
                            <div className="dropdown__menu" role="menu" onMouseLeave={() => setMenuFor(null)}>
                              {actions.map((a) =>
                                a.key === 'edit' ? (
                                  <Link key={a.key} to={`/account/listings/${l.id}/edit`} className="dropdown__item" role="menuitem">
                                    {a.icon} {a.label}
                                  </Link>
                                ) : (
                                  <button
                                    key={a.key}
                                    type="button"
                                    role="menuitem"
                                    className={`dropdown__item${a.key === 'withdraw' ? ' dropdown__item--danger' : ''}`}
                                    onClick={() => {
                                      setMenuFor(null);
                                      a.onClick();
                                    }}
                                  >
                                    {a.icon} {a.label}
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination page={listings.data.page} totalPages={listings.data.totalPages} onChange={(p) => setSearchParams({ ...(status !== 'all' ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) })} />
          </>
        )}
      </section>

      <Modal
        open={Boolean(pending)}
        title={pending ? CONFIRM_COPY[pending.type].title : ''}
        description={pending?.listing.title}
        onClose={() => setPending(null)}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button variant={pending?.type === 'withdraw' ? 'danger' : 'primary'} isLoading={working} onClick={runAction}>
              {pending ? CONFIRM_COPY[pending.type].button : ''}
            </Button>
          </>
        }
      >
        <p className="text-secondary">{pending ? CONFIRM_COPY[pending.type].text : ''}</p>
      </Modal>
    </>
  );
}
