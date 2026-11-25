import { useState } from 'react';
import { BadgeCheck, CalendarDays, ChevronRight, Eye, Flag, Info, MapPin, MessageSquare, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { ListingImage } from '../../components/listings/ListingImage';
import { SaveButton } from '../../components/listings/SaveButton';
import { Avatar } from '../../components/ui/Avatar';
import { ListingStatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SelectField, TextareaField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAuth } from '../../features/auth/context/useAuth';
import { hasPermission, rolePath } from '../../features/auth/rbac';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { categoriesService } from '../../services/categories.service';
import { conversationsService } from '../../services/conversations.service';
import { listingsService } from '../../services/listings.service';
import { ApiError } from '../../api/errors';
import { REPORT_REASONS, type Listing, type ReportReason } from '../../types';
import { formatDate, formatNumber, formatPrice, formatRelative, LISTING_TYPE_LABELS } from '../../utils/format';

function Gallery({ listing }: { listing: Listing }) {
  const photos = [...listing.photos].sort((a, b) => a.position - b.position);
  const [index, setIndex] = useState(0);
  const current = photos[index];
  return (
    <div className="gallery card">
      <div className="gallery__main">
        <ListingImage listing={{ ...listing, photos: current ? [current] : [] }} iconSize={96} />
      </div>
      {photos.length > 1 && (
        <div className="gallery__thumbs" role="tablist" aria-label="Photos">
          {photos.map((photo, i) => (
            <button key={photo.id} type="button" role="tab" aria-selected={i === index} className="gallery__thumb" onClick={() => setIndex(i)} aria-label={`Photo ${i + 1}`}>
              <img src={photo.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ListingDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const listing = useAsync(() => listingsService.getById(id), [id]);
  const categories = useAsync(() => categoriesService.list(), []);
  const [contacting, setContacting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | ''>('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [reporting, setReporting] = useState(false);
  useDocumentTitle(listing.data?.title ?? 'Ad details');

  if (listing.isLoading) return <LoadingState label="Loading ad..." />;
  if (listing.error || !listing.data) {
    if (listing.error instanceof ApiError && listing.error.isNotFound) {
      return (
        <div className="container section">
          <div className="card">
            <EmptyState title="This ad is not available" text="It may have been sold, withdrawn or removed." action={<ButtonLink to="/search">Browse other ads</ButtonLink>} />
          </div>
        </div>
      );
    }
    return (
      <div className="container section">
        <ErrorState error={listing.error} onRetry={listing.reload} />
      </div>
    );
  }

  const ad = listing.data;
  const category = categories.data?.find((c) => c.id === ad.categoryId);
  const isOwner = user?.id === ad.sellerId;
  const isAdmin = user?.role === 'admin';
  const isAvailable = ad.status === 'published' && ad.availability === 'available';
  const canMessage = !isOwner && hasPermission(user?.role, 'messages:use');
  const canReport = !isOwner && hasPermission(user?.role, 'listings:report');

  const loginFirst = () => navigate(`/login?redirect=${encodeURIComponent(`/listings/${ad.id}`)}`);

  const contactSeller = async () => {
    if (!user) return loginFirst();
    setContacting(true);
    try {
      const conversation = await conversationsService.start(ad.id);
      navigate(rolePath(user.role, `messages?c=${conversation.id}`));
    } catch (error) {
      toast.show({ title: 'Could not open chat', message: getErrorMessage(error), tone: 'error' });
    } finally {
      setContacting(false);
    }
  };

  const submitReport = async () => {
    if (!reportReason) {
      setReportError('Choose a reason.');
      return;
    }
    setReporting(true);
    try {
      await listingsService.report(ad.id, reportReason, reportDetails.trim());
      toast.show({ title: 'Report sent', message: 'Thank you. Our team will review this ad.' });
      setReportOpen(false);
      setReportReason('');
      setReportDetails('');
      setReportError('');
    } catch (error) {
      setReportError(getErrorMessage(error));
    } finally {
      setReporting(false);
    }
  };

  const attributeRows = category
    ? category.fields
        .filter((f) => ad.attributes[f.fieldKey] !== undefined && ad.attributes[f.fieldKey] !== '')
        .map((f) => {
          const raw = ad.attributes[f.fieldKey];
          const value = f.inputType === 'number' && f.fieldKey !== 'year' ? formatNumber(Number(raw)) : String(raw);
          return { label: f.label, value: f.unit ? `${value} ${f.unit}` : value };
        })
    : Object.entries(ad.attributes).map(([label, value]) => ({ label, value: String(value) }));

  return (
    <div className="container detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to={`/search?category=${ad.categorySlug}`}>{ad.categoryName}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{ad.title}</span>
      </nav>

      {(isOwner || isAdmin) && ad.status !== 'published' && (
        <div className="alert alert--warning" style={{ marginBottom: 'var(--space-5)' }}>
          <Info size={16} />
          <div>
            Only you{isAdmin ? ' (admin)' : ''} can see this ad. Status: <ListingStatusBadge status={ad.status} />
            {ad.moderationNote && <p style={{ marginTop: 6 }}>Note from moderator: {ad.moderationNote}</p>}
          </div>
        </div>
      )}
      {ad.status === 'published' && ad.availability !== 'available' && (
        <div className="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <Info size={16} /> This ad has been marked as {ad.availability}. It is kept here for reference.
        </div>
      )}

      <div className="detail__layout">
        <div className="detail__main">
          <Gallery listing={ad} />

          <section className="card">
            <h2 className="card-title">Details</h2>
            <dl className="spec-grid">
              <div>
                <dt>Type</dt>
                <dd>{LISTING_TYPE_LABELS[ad.listingType]}</dd>
              </div>
              {attributeRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div>
                <dt>Location</dt>
                <dd>
                  {ad.district}, {ad.city}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title">Description</h2>
            <p className="detail__description">{ad.description}</p>
          </section>
        </div>

        <aside className="detail__side">
          <div className="card detail__summary">
            <div className="detail__summary-top">
              <span className="badge badge--primary">{ad.categoryName}</span>
              {isAvailable && <SaveButton listingId={ad.id} />}
            </div>
            <h1 className="detail__title">{ad.title}</h1>
            <p className="detail__price tabular">{formatPrice(ad.price, ad.listingType)}</p>
            {ad.listingType === 'service' && ad.attributes.priceType === 'Starting from' && <p className="text-muted">Starting price</p>}
            <ul className="detail__meta">
              <li>
                <MapPin size={15} /> {ad.district}, {ad.city}
              </li>
              <li>
                <CalendarDays size={15} /> Posted {formatRelative(ad.publishedAt ?? ad.createdAt)}
              </li>
              <li>
                <Eye size={15} /> {formatNumber(ad.views)} views
              </li>
            </ul>

            {isOwner ? (
              <ButtonLink to="/account/listings" variant="primary" block>
                Manage in my ads
              </ButtonLink>
            ) : isAdmin ? (
              <ButtonLink to={`/admin/moderation?status=all&q=${encodeURIComponent(ad.title)}`} variant="primary" block icon={<ShieldCheck size={18} />}>
                Open in moderation
              </ButtonLink>
            ) : isAvailable ? (
              <Button variant="primary" block size="lg" icon={<MessageSquare size={18} />} isLoading={contacting} onClick={canMessage || !user ? contactSeller : undefined} disabled={Boolean(user) && !canMessage}>
                {user ? 'Message seller' : 'Sign in to message seller'}
              </Button>
            ) : null}
          </div>

          <div className="card">
            <div className="seller-card">
              <Avatar name={ad.seller.name} src={ad.seller.avatarUrl} size="lg" />
              <div>
                <strong className="seller-card__name">{ad.seller.name}</strong>
                <p className="text-muted">Member since {formatDate(ad.seller.memberSince)}</p>
                {ad.seller.phoneVerified && (
                  <span className="badge badge--success" style={{ marginTop: 6 }}>
                    <BadgeCheck size={12} /> Phone verified
                  </span>
                )}
              </div>
            </div>
            <p className="text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
              {formatNumber(ad.seller.activeListings)} live {ad.seller.activeListings === 1 ? 'ad' : 'ads'}. A verified phone number confirms the seller can receive codes; it is not an identity check.
            </p>
          </div>

          <div className="card safety-card">
            <h2 className="card-title">
              <ShieldAlert size={18} /> Stay safe
            </h2>
            <ul>
              <li>Meet in a busy public place.</li>
              <li>Check the item and documents before paying.</li>
              <li>Never send a deposit or pay before viewing.</li>
            </ul>
            {canReport && (
              <Button variant="ghost" size="sm" icon={<Flag size={15} />} onClick={() => setReportOpen(true)}>
                Report this ad
              </Button>
            )}
            {!user && (
              <Button variant="ghost" size="sm" icon={<Flag size={15} />} onClick={loginFirst}>
                Sign in to report this ad
              </Button>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={reportOpen}
        title="Report this ad"
        description="Tell us what is wrong. Reports are private; the seller will not see your name."
        onClose={() => setReportOpen(false)}
        footer={
          <>
            <Button onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button variant="primary" isLoading={reporting} onClick={submitReport}>
              Send report
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <SelectField
            label="Reason"
            required
            value={reportReason}
            onChange={(reason) => {
              setReportReason(reason as ReportReason);
              setReportError('');
            }}
            placeholder="Choose a reason"
            options={REPORT_REASONS.map((r) => ({ value: r, label: r }))}
            error={reportError}
          />
          <TextareaField label="Details (optional)" value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} maxLength={1000} placeholder="Anything that helps our team review this ad" />
        </div>
      </Modal>
    </div>
  );
}
