import { useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Download, Eye, Heart, Layers, MessageSquare, Pencil, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bucketDaily } from '../../components/charts/buckets';
import { GaugeChart } from '../../components/charts/GaugeChart';
import { SegmentedBar } from '../../components/charts/SegmentedBar';
import { StackedBarChart } from '../../components/charts/StackedBarChart';
import { ConversationPreviewList } from '../../components/dashboard/ConversationPreviewList';
import { greeting } from '../../components/dashboard/greeting';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { RangePicker } from '../../components/dashboard/RangePicker';
import { RANGE_LABEL } from '../../components/dashboard/range-labels';
import { StatCard, StatCardSkeleton } from '../../components/dashboard/StatCard';
import { ListingCard } from '../../components/listings/ListingCard';
import { ListingImage } from '../../components/listings/ListingImage';
import { ListingStatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useAuth } from '../../features/auth/context/useAuth';
import { canSell } from '../../features/auth/rbac';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { dashboardService, type DashboardRange } from '../../services/dashboard.service';
import type { ListingStatus } from '../../types';
import { downloadCsv } from '../../utils/csv';
import { formatNumber, formatPrice, formatRelative } from '../../utils/format';
import { t, tn } from '../../i18n';

const KPI_ICONS: Record<string, ReactNode> = {
  liveListings: <Layers size={18} />,
  totalViews: <Eye size={18} />,
  conversations: <MessageSquare size={18} />,
  saved: <Heart size={18} />,
};

/** Validated categorical order (purple, teal, amber, blue, pink); grey is reserved for "withdrawn" */
const STATUS_COLORS: Partial<Record<ListingStatus, { label: string; color: string }>> = {
  published: { label: t('Live'), color: 'var(--series-1)' },
  pending_review: { label: t('In review'), color: 'var(--series-2)' },
  changes_required: { label: t('Needs changes'), color: 'var(--series-3)' },
  draft: { label: t('Draft'), color: 'var(--series-4)' },
  rejected: { label: t('Rejected'), color: 'var(--series-5)' },
  withdrawn: { label: t('Withdrawn'), color: 'var(--series-other)' },
};

const LOCKED: ListingStatus[] = ['withdrawn', 'hidden', 'rejected'];

export function UserDashboardPage() {
  useDocumentTitle(t('Dashboard'));
  const { user } = useAuth();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, error, isLoading, reload } = useAsync(() => dashboardService.user(range), [range]);

  const bars = useMemo(() => (data ? bucketDaily(data.engagement, ['views', 'messages']) : []), [data]);
  const totals = useMemo(
    () => (data ? data.engagement.reduce((acc, p) => ({ views: acc.views + p.views, messages: acc.messages + p.messages }), { views: 0, messages: 0 }) : { views: 0, messages: 0 }),
    [data],
  );

  const listings = data?.myListings ?? [];
  const allSelected = listings.length > 0 && listings.every((l) => selected.has(l.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportData = () => {
    if (!data) return;
    downloadCsv(
      `finovo-souq-activity-${range}.csv`,
      ['Date', 'Views', 'Messages'],
      data.engagement.map((p) => [p.date, p.views, p.messages]),
    );
  };

  const exportSelected = () => {
    const rows = listings.filter((l) => selected.has(l.id));
    downloadCsv(
      'finovo-souq-my-ads.csv',
      ['Title', 'Category', 'Price (SAR)', 'Views', 'Status', 'Updated'],
      rows.map((l) => [l.title, l.categoryName, l.price, l.views, l.status, l.updatedAt]),
    );
  };

  return (
    <>
      <PageHeader
        title={greeting(user?.name)}
        subtitle={t('Here is how your ads and conversations are doing.')}
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <Button icon={<Download size={16} />} onClick={exportData} disabled={!data}>
              {t('Export')}
            </Button>
            {canSell(user) && (
              <ButtonLink to="/account/listings/new" variant="primary" icon={<PlusCircle size={16} />}>
                {t('Post an ad')}
              </ButtonLink>
            )}
          </>
        }
      />

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : (
        <div className="dash-grid">
          {data && data.actionRequired.length > 0 && (
            <div className="action-banner span-12">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <strong>{tn(data.actionRequired.length, '{count} ad needs your attention', '{count} ads need your attention')}</strong>
                <p>
                  {data.actionRequired
                    .map((l) => l.title)
                    .slice(0, 2)
                    .join(', ')}
                  {data.actionRequired.length > 2 ? '...' : ''}
                </p>
              </div>
              <ButtonLink to="/account/listings?status=changes_required" size="sm">
                {t('Review')}
              </ButtonLink>
            </div>
          )}

          <div className="kpi-row">
            {isLoading || !data
              ? Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
              : data.kpis.map((metric) => <StatCard key={metric.key} metric={metric} icon={KPI_ICONS[metric.key]} periodLabel={RANGE_LABEL[range]} />)}
          </div>

          <section className="card span-8">
            <div className="card-header">
              <div>
                <h2 className="card-title">{t('Ad performance')}</h2>
                <p className="card-subtitle">{t('Views and new messages on your ads')}</p>
              </div>
            </div>
            {isLoading || !data ? (
              <SkeletonBlock height={290} />
            ) : (
              <>
                <div className="figure-row">
                  <p className="figure">
                    <span className="figure__label">{t('Views')}</span>
                    <strong className="tabular">{formatNumber(totals.views)}</strong>
                  </p>
                  <p className="figure">
                    <span className="figure__label">{t('Messages')}</span>
                    <strong className="tabular">{formatNumber(totals.messages)}</strong>
                  </p>
                </div>
                <StackedBarChart
                  data={bars}
                  label={t('Views and messages per day')}
                  series={[
                    { name: 'Views', color: 'var(--series-1)' },
                    { name: 'Messages', color: 'var(--series-1)', striped: true },
                  ]}
                />
              </>
            )}
          </section>

          <div className="span-4 stack">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">{t('Your ads by status')}</h2>
                  <p className="card-subtitle">{t('All ads on your account')}</p>
                </div>
              </div>
              {isLoading || !data ? (
                <SkeletonBlock height={150} />
              ) : data.adsByStatus.length === 0 ? (
                <p className="text-muted">{t('You have not posted an ad yet.')}</p>
              ) : (
                <SegmentedBar
                  label={t('Ads by status')}
                  segments={data.adsByStatus.map((s) => ({ label: STATUS_COLORS[s.status]?.label ?? s.status, value: s.count, color: STATUS_COLORS[s.status]?.color ?? 'var(--series-other)' }))}
                />
              )}
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">{t('Reply rate')}</h2>
                  <p className="card-subtitle">{t('Buyer messages you answered')}</p>
                </div>
              </div>
              {isLoading || !data ? <SkeletonBlock height={120} /> : <GaugeChart value={data.responseRate} label={t('Reply rate')} caption="answered" />}
            </section>
          </div>

          <section className="card card--flush span-8">
            <div className="card-header card-header--padded">
              <div>
                <h2 className="card-title">{t('My ads')}</h2>
                <p className="card-subtitle">{t('Recently updated')}</p>
              </div>
              <div className="card-header__tools">
                {selected.size > 0 && (
                  <Button size="sm" icon={<Download size={15} />} onClick={exportSelected}>
                    {t('Export')} {selected.size}
                  </Button>
                )}
                <ButtonLink to="/account/listings" size="sm">
                  {t('View all')}
                </ButtonLink>
              </div>
            </div>
            {isLoading || !data ? (
              <div className="card-body">
                <SkeletonBlock height={240} />
              </div>
            ) : listings.length === 0 ? (
              <EmptyState
                title={t('No ads yet')}
                text={t('Post your first ad. It is checked by our team before it goes live.')}
                action={
                  <ButtonLink to="/account/listings/new" variant="primary" icon={<PlusCircle size={16} />}>
                    {t('Post an ad')}
                  </ButtonLink>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="table table--select">
                  <thead>
                    <tr>
                      <th className="table__check">
                        <input
                          type="checkbox"
                          className="check"
                          checked={allSelected}
                          onChange={() => setSelected(allSelected ? new Set() : new Set(listings.map((l) => l.id)))}
                          aria-label={t('Select all ads')}
                        />
                      </th>
                      <th>{t('Ad')}</th>
                      <th className="table__num">{t('Price')}</th>
                      <th className="table__num">{t('Views')}</th>
                      <th>{t('Status')}</th>
                      <th>{t('Updated')}</th>
                      <th className="table__actions">
                        <span className="sr-only">{t('Actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l.id} className={selected.has(l.id) ? 'is-selected' : undefined}>
                        <td className="table__check">
                          <input
                            type="checkbox"
                            className="check"
                            checked={selected.has(l.id)}
                            onChange={() => toggle(l.id)}
                            aria-label={t('Select {title}', {
                              title: l.title,
                            })}
                          />
                        </td>
                        <td>
                          <span className="table-item">
                            <span className="table-item__thumb">
                              <ListingImage listing={l} iconSize={18} />
                            </span>
                            <span>
                              <span className="table-item__title">{l.title}</span>
                              <span className="table-item__meta">
                                {l.categoryName} · {t(l.city)}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="table__num">{formatPrice(l.price, l.listingType)}</td>
                        <td className="table__num">{formatNumber(l.views)}</td>
                        <td>
                          <ListingStatusBadge status={l.status} availability={l.availability} />
                        </td>
                        <td className="text-muted">{formatRelative(l.updatedAt)}</td>
                        <td className="table__actions">
                          <Link
                            to={`/listings/${l.id}`}
                            className="icon-btn icon-btn--sm"
                            aria-label={t('View {title}', {
                              title: l.title,
                            })}
                          >
                            <Eye size={16} />
                          </Link>
                          {!LOCKED.includes(l.status) && (
                            <Link
                              to={`/account/listings/${l.id}/edit`}
                              className="icon-btn icon-btn--sm"
                              aria-label={t('Edit {title}', {
                                title: l.title,
                              })}
                            >
                              <Pencil size={15} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card span-4">
            <div className="card-header">
              <div>
                <h2 className="card-title">{t('Recent messages')}</h2>
                <p className="card-subtitle">{t('Buyers and sellers')}</p>
              </div>
              <Link to="/account/messages" className="link">
                {t('View all')}
              </Link>
            </div>
            {isLoading || !data ? <SkeletonBlock height={220} /> : <ConversationPreviewList conversations={data.recentConversations} basePath="/account/messages" />}
          </section>

          <section className="card span-12">
            <div className="card-header">
              <div>
                <h2 className="card-title">{t('Saved ads')}</h2>
                <p className="card-subtitle">{t('Ads you are keeping an eye on')}</p>
              </div>
              <Link to="/account/saved" className="link">
                {t('View all')}
              </Link>
            </div>
            {isLoading || !data ? (
              <SkeletonBlock height={200} />
            ) : data.savedListings.length === 0 ? (
              <p className="text-muted">
                {t('Tap the heart on any ad to save it here.')}{' '}
                <Link to="/search" className="link">
                  {t('Browse ads')}
                </Link>
              </p>
            ) : (
              <div className="listing-grid listing-grid--compact">
                {data.savedListings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
