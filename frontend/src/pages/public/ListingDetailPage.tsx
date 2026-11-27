import { Fragment, useState } from 'react';
import { CalendarDays, ChevronRight, Eye, Flag, Info, MapPin, MessageSquare, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { ListingImage } from '../../components/listings/ListingImage';
import { SellerTrustFacts } from '../../components/listings/SellerTrustFacts';
import { SimilarAds } from '../../components/listings/SimilarAds';
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
import { formatNumber, formatPrice, formatRelative, LISTING_TYPE_LABELS } from '../../utils/format';
import { t } from '../../i18n';

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
        <div className="gallery__thumbs" role="tablist" aria-label={t('Photos')}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className="gallery__thumb"
              onClick={() => setIndex(i)}
              aria-label={t('Photo {i}', {
                i: i + 1,
              })}
            >
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

  if (listing.isLoading) return <LoadingState label={t('Loading ad...')} />;
  if (listing.error || !listing.data) {
    if (listing.error instanceof ApiError && listing.error.isNotFound) {
      return (
        <div className="container section">
          <div className="card">
            <EmptyState title={t('This ad is not available')} text={t('It may have been sold, withdrawn or removed.')} action={<ButtonLink to="/search">{t('Browse other ads')}</ButtonLink>} />
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
      toast.show({ title: t('Could not open chat'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setContacting(false);
    }
  };

  const submitReport = async () => {
    if (!reportReason) {
      setReportError(t('Choose a reason.'));
      return;
    }
    setReporting(true);
    try {
      await listingsService.report(ad.id, reportReason, reportDetails.trim());
      toast.show({ title: t('Report sent'), message: t('Thank you. Our team will review this ad.') });
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
          const value = f.inputType === 'number' && f.fieldKey !== 'year' ? formatNumber(Number(raw)) : t(String(raw));
          return { label: f.label, value: f.unit ? `${value} ${f.unit}` : value };
        })
    : Object.entries(ad.attributes).map(([label, value]) => ({ label, value: String(value) }));

  return (
    <div className="container detail">
      <nav className="breadcrumb" aria-label={t('Breadcrumb')}>
        <Link to="/">{t('Home')}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        {ad.categoryTrail.map((c) => (
          <Fragment key={c.id}>
            <Link to={`/search?category=${c.slug}`}>{c.name}</Link>
            <ChevronRight size={14} aria-hidden="true" />
          </Fragment>
        ))}
        <span aria-current="page">{ad.title}</span>
      </nav>

      {(isOwner || isAdmin) && ad.status !== 'published' && (
        <div className="alert alert--warning" style={{ marginBottom: 'var(--space-5)' }}>
          <Info size={16} />
          <div>
            {t('Only you')}
            {isAdmin ? t(' (admin)') : ''} {t('can see this ad. Status:')} <ListingStatusBadge status={ad.status} />
            {ad.moderationNote && (
              <p style={{ marginTop: 6 }}>
                {t('Note from moderator:')} {ad.moderationNote}
              </p>
            )}
          </div>
        </div>
      )}
      {ad.status === 'published' && ad.availability !== 'available' && (
        <div className="alert" style={{ marginBottom: 'var(--space-5)' }}>
          <Info size={16} /> {t('This ad has been marked as')} {ad.availability}
          {t('. It is kept here for reference.')}
        </div>
      )}

      <div className="detail__layout">
        <div className="detail__main">
          <Gallery listing={ad} />

          <section className="card">
            <h2 className="card-title">{t('Details')}</h2>
            <dl className="spec-grid">
              <div>
                <dt>{t('Type')}</dt>
                <dd>{LISTING_TYPE_LABELS[ad.listingType]}</dd>
              </div>
              {attributeRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div>
                <dt>{t('Location')}</dt>
                <dd>
                  {ad.district}, {t(ad.city)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title">{t('Description')}</h2>
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
            {ad.listingType === 'service' && ad.attributes.priceType === 'Starting from' && <p className="text-muted">{t('Starting price')}</p>}
            <ul className="detail__meta">
              <li>
                <MapPin size={15} /> {ad.district}, {t(ad.city)}
              </li>
              <li>
                <CalendarDays size={15} /> {t('Posted')} {formatRelative(ad.publishedAt ?? ad.createdAt)}
              </li>
              <li>
                <Eye size={15} /> {formatNumber(ad.views)} {t('views')}
              </li>
            </ul>

            {isOwner ? (
              <ButtonLink to="/account/listings" variant="primary" block>
                {t('Manage in my ads')}
              </ButtonLink>
            ) : isAdmin ? (
              <ButtonLink to={`/admin/moderation?status=all&q=${encodeURIComponent(ad.title)}`} variant="primary" block icon={<ShieldCheck size={18} />}>
                {t('Open in moderation')}
              </ButtonLink>
            ) : isAvailable ? (
              <Button
                variant="primary"
                block
                size="lg"
                icon={<MessageSquare size={18} />}
                isLoading={contacting}
                onClick={canMessage || !user ? contactSeller : undefined}
                disabled={Boolean(user) && !canMessage}
              >
                {user ? t('Message seller') : t('Sign in to message seller')}
              </Button>
            ) : null}
          </div>

          <div className="card">
            <div className="seller-card">
              <Avatar name={ad.seller.name} src={ad.seller.avatarUrl} size="lg" />
              <div>
                <Link to={`/sellers/${ad.seller.id}`} className="seller-card__name">
                  {ad.seller.name}
                </Link>
                {ad.seller.city && <p className="text-muted">{t(ad.seller.city)}</p>}
              </div>
            </div>
            <SellerTrustFacts seller={ad.seller} />
            <ButtonLink to={`/sellers/${ad.seller.id}`} block className="seller-card__all">
              {t('View all ads from this seller')}
            </ButtonLink>
          </div>

          <div className="card safety-card">
            <h2 className="card-title">
              <ShieldAlert size={18} /> {t('Stay safe')}
            </h2>
            <ul>
              <li>{t('Meet in a busy public place.')}</li>
              <li>{t('Check the item and documents before paying.')}</li>
              <li>{t('Never send a deposit or pay before viewing.')}</li>
            </ul>
            <Link to="/safety" className="link safety-card__more">
              {t('Read all safety tips')}
            </Link>
            {canReport && (
              <Button variant="ghost" size="sm" icon={<Flag size={15} />} onClick={() => setReportOpen(true)}>
                {t('Report this ad')}
              </Button>
            )}
            {!user && (
              <Button variant="ghost" size="sm" icon={<Flag size={15} />} onClick={loginFirst}>
                {t('Sign in to report this ad')}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {ad.status === 'published' && <SimilarAds listingId={ad.id} />}

      <Modal
        open={reportOpen}
        title={t('Report this ad')}
        description={t('Tell us what is wrong. Reports are private; the seller will not see your name.')}
        onClose={() => setReportOpen(false)}
        footer={
          <>
            <Button onClick={() => setReportOpen(false)}>{t('Cancel')}</Button>
            <Button variant="primary" isLoading={reporting} onClick={submitReport}>
              {t('Send report')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <SelectField
            label={t('Reason')}
            required
            value={reportReason}
            onChange={(reason) => {
              setReportReason(reason as ReportReason);
              setReportError('');
            }}
            placeholder={t('Choose a reason')}
            options={REPORT_REASONS.map((r) => ({ value: r, label: t(r) }))}
            error={reportError}
          />
          <TextareaField
            label={t('Details (optional)')}
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            maxLength={1000}
            placeholder={t('Anything that helps our team review this ad')}
          />
        </div>
      </Modal>
    </div>
  );
}
