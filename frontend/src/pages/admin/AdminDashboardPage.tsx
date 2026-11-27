import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Download, Eye, Flag, Layers, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bucketDaily } from '../../components/charts/buckets';
import { GaugeChart } from '../../components/charts/GaugeChart';
import { SegmentedBar } from '../../components/charts/SegmentedBar';
import { StackedBarChart } from '../../components/charts/StackedBarChart';
import { greeting } from '../../components/dashboard/greeting';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { RangePicker } from '../../components/dashboard/RangePicker';
import { RANGE_LABEL } from '../../components/dashboard/range-labels';
import { StatCard, StatCardSkeleton } from '../../components/dashboard/StatCard';
import { ListingImage } from '../../components/listings/ListingImage';
import { ReportStatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useAuth } from '../../features/auth/context/useAuth';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { dashboardService, type DashboardRange } from '../../services/dashboard.service';
import { downloadCsv } from '../../utils/csv';
import { formatNumber, formatPrice, formatRelative } from '../../utils/format';
import { t } from '../../i18n';

const KPI_ICONS: Record<string, ReactNode> = {
  liveListings: <Layers size={18} />,
  pendingReview: <ShieldCheck size={18} />,
  activeUsers: <Users size={18} />,
  openReports: <Flag size={18} />,
};

const CATEGORY_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];

// Fewer pending ads and fewer open reports are good news
const LOWER_IS_BETTER = new Set(['pendingReview', 'openReports']);

export function AdminDashboardPage() {
  useDocumentTitle(t('Admin dashboard'));
  const { user } = useAuth();
  const [range, setRange] = useState<DashboardRange>('30d');
  const { data, error, isLoading, reload } = useAsync(() => dashboardService.admin(range), [range]);

  const activity = useMemo(() => {
    if (!data) return { bars: [], submitted: 0, approved: 0 };
    const daily = data.listingsTrend.map((p, i) => {
      const approved = Math.min(p.value, data.approvalsTrend[i]?.value ?? 0);
      return { date: p.date, approved, other: p.value - approved };
    });
    return {
      bars: bucketDaily(daily, ['approved', 'other']),
      submitted: data.listingsTrend.reduce((sum, p) => sum + p.value, 0),
      approved: daily.reduce((sum, p) => sum + p.approved, 0),
    };
  }, [data]);

  const exportData = () => {
    if (!data) return;
    downloadCsv(
      `finovo-souq-admin-${range}.csv`,
      ['Date', 'Ads submitted', 'Ads approved'],
      data.listingsTrend.map((p, i) => [p.date, p.value, Math.min(p.value, data.approvalsTrend[i]?.value ?? 0)]),
    );
  };

  return (
    <>
      <PageHeader
        title={greeting(user?.name)}
        subtitle={t('Here is what is happening on Finovo Souq.')}
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <Button variant="primary" icon={<Download size={16} />} onClick={exportData} disabled={!data}>
              {t('Export data')}
            </Button>
          </>
        }
      />

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : (
        <div className="dash-grid">
          <div className="kpi-row">
            {isLoading || !data
              ? Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
              : data.kpis.map((metric) => (
                  <StatCard key={metric.key} metric={metric} icon={KPI_ICONS[metric.key]} higherIsBetter={!LOWER_IS_BETTER.has(metric.key)} periodLabel={RANGE_LABEL[range]} />
                ))}
          </div>

          <section className="card span-8">
            <div className="card-header">
              <div>
                <h2 className="card-title">{t('Ads submitted')}</h2>
                <p className="card-subtitle">{t('Ads sent for review, and how many were approved')}</p>
              </div>
            </div>
            {isLoading || !data ? (
              <SkeletonBlock height={290} />
            ) : (
              <>
                <div className="figure-row">
                  <p className="figure">
                    <span className="figure__label">{t('Submitted')}</span>
                    <strong className="tabular">{formatNumber(activity.submitted)}</strong>
                  </p>
                  <p className="figure">
                    <span className="figure__label">{t('Approved')}</span>
                    <strong className="tabular">{formatNumber(activity.approved)}</strong>
                  </p>
                </div>
                <StackedBarChart
                  data={activity.bars}
                  label={t('Ads submitted per day, split into approved and not approved')}
                  series={[
                    { name: 'Approved', color: 'var(--series-1)' },
                    { name: 'Not approved yet', color: 'var(--series-1)', striped: true },
                  ]}
                />
              </>
            )}
          </section>

          <div className="span-4 stack">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">{t('Live ads by category')}</h2>
                  <p className="card-subtitle">{t('Share of all live ads')}</p>
                </div>
              </div>
              {isLoading || !data ? (
                <SkeletonBlock height={190} />
              ) : (
                <SegmentedBar
                  label={t('Live ads by category')}
                  segments={data.categoryBreakdown.map((c, i) => ({ label: c.name, value: c.count, color: CATEGORY_COLORS[i] ?? 'var(--series-other)' }))}
                />
              )}
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">{t('Approval rate')}</h2>
                  <p className="card-subtitle">{t('Reviewed ads that went live')}</p>
                </div>
              </div>
              {isLoading || !data ? <SkeletonBlock height={140} /> : <GaugeChart value={data.approvalRate} label={t('Approval rate')} caption="approved" />}
            </section>
          </div>

          <section className="card card--flush span-8">
            <div className="card-header card-header--padded">
              <div>
                <h2 className="card-title">{t('Waiting for review')}</h2>
                <p className="card-subtitle">{t('Oldest first')}</p>
              </div>
              <ButtonLink to="/admin/moderation" size="sm" icon={<ArrowRight size={15} />}>
                {t('Open queue')}
              </ButtonLink>
            </div>
            {isLoading || !data ? (
              <div className="card-body">
                <SkeletonBlock height={220} />
              </div>
            ) : data.pendingQueue.length === 0 ? (
              <p className="text-muted card-body">{t('Nothing waiting. Great work.')}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Ad')}</th>
                      <th>{t('Seller')}</th>
                      <th>{t('City')}</th>
                      <th className="table__num">{t('Price')}</th>
                      <th className="table__num">{t('Submitted')}</th>
                      <th className="table__actions">
                        <span className="sr-only">{t('Actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingQueue.map((listing) => (
                      <tr key={listing.id}>
                        <td>
                          <Link to={`/admin/moderation?review=${listing.id}`} className="table-item">
                            <span className="table-item__thumb">
                              <ListingImage listing={listing} iconSize={20} />
                            </span>
                            <span>
                              <span className="table-item__title">{listing.title}</span>
                              <span className="table-item__meta">{listing.categoryName}</span>
                            </span>
                          </Link>
                        </td>
                        <td>{listing.seller.name}</td>
                        <td>{t(listing.city)}</td>
                        <td className="table__num">{formatPrice(listing.price, listing.listingType)}</td>
                        <td className="table__num text-muted">{formatRelative(listing.updatedAt)}</td>
                        <td className="table__actions">
                          <Link
                            to={`/admin/moderation?review=${listing.id}`}
                            className="icon-btn icon-btn--sm"
                            aria-label={t('Review {title}', {
                              title: listing.title,
                            })}
                          >
                            <Eye size={16} />
                          </Link>
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
                <h2 className="card-title">{t('Latest reports')}</h2>
                <p className="card-subtitle">{t('From buyers and sellers')}</p>
              </div>
              <Link to="/admin/reports" className="link">
                {t('View all')}
              </Link>
            </div>
            {isLoading || !data ? (
              <SkeletonBlock height={220} />
            ) : (
              <ul className="report-list">
                {data.recentReports.map((report) => (
                  <li key={report.id}>
                    <div className="preview-list__row">
                      <strong>{t(report.reason)}</strong>
                      <ReportStatusBadge status={report.status} />
                    </div>
                    <p className="preview-list__sub">{report.listingTitle}</p>
                    <p className="preview-list__time">
                      {report.reporter.name} - {formatRelative(report.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
