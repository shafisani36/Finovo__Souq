import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { ReportStatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { ReportStatus } from '../../types';
import { formatRelative } from '../../utils/format';
import { t } from '../../i18n';

const TABS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'open', label: t('Open') },
  { value: 'reviewing', label: t('Reviewing') },
  { value: 'resolved', label: t('Resolved') },
  { value: 'dismissed', label: t('Dismissed') },
  { value: 'all', label: t('All') },
];

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: t('Open') },
  { value: 'reviewing', label: t('Reviewing') },
  { value: 'resolved', label: t('Resolved') },
  { value: 'dismissed', label: t('Dismissed') },
];

export function ReportsPage() {
  useDocumentTitle(t('Reports'));
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'open';
  const page = Number(searchParams.get('page')) || 1;
  const reports = useAsync(() => adminService.reports({ status, page }), [status, page]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const changeStatus = async (id: string, next: ReportStatus) => {
    setUpdatingId(id);
    try {
      const updated = await adminService.setReportStatus(id, next);
      reports.setData((prev) => (prev ? { ...prev, items: prev.items.map((r) => (r.id === id ? updated : r)) } : prev));
      toast.show({ title: t('Report updated') });
    } catch (error) {
      toast.show({ title: t('Could not update report'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <PageHeader title={t('Reports')} subtitle={t('Ads reported by users. Review the ad, then hide it from Moderation if it breaks the rules.')} />
      <section className="card">
        <div className="toolbar">
          <div className="segmented segmented--scroll" role="tablist" aria-label={t('Report status')}>
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                className="segmented__item"
                onClick={() => setSearchParams(tab.value === 'open' ? {} : { status: tab.value })}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {reports.error ? (
          <ErrorState error={reports.error} onRetry={reports.reload} />
        ) : reports.isLoading || !reports.data ? (
          <SkeletonBlock height={300} />
        ) : reports.data.items.length === 0 ? (
          <EmptyState icon={<Flag size={26} />} title={t('No reports here')} text={t('Reports from users will show up in this list.')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Reason')}</th>
                    <th>{t('Ad')}</th>
                    <th>{t('Reported by')}</th>
                    <th>{t('Status')}</th>
                    <th className="table__num">{t('Received')}</th>
                    <th className="table__num">{t('Update')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.data.items.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <strong>{t(report.reason)}</strong>
                        {report.details && (
                          <p className="table-item__meta" style={{ maxWidth: 280 }}>
                            {report.details}
                          </p>
                        )}
                      </td>
                      <td>
                        <Link to={`/admin/moderation?status=all&review=${report.listingId}`} className="link">
                          {report.listingTitle}
                        </Link>
                      </td>
                      <td>{report.reporter.name}</td>
                      <td>
                        <ReportStatusBadge status={report.status} />
                      </td>
                      <td className="table__num">{formatRelative(report.createdAt)}</td>
                      <td className="table__num">
                        <Select
                          size="sm"
                          value={report.status}
                          disabled={updatingId === report.id}
                          onChange={(next) => void changeStatus(report.id, next as ReportStatus)}
                          options={STATUS_OPTIONS}
                          aria-label={t('Status for report on {listingTitle}', {
                            listingTitle: report.listingTitle,
                          })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={reports.data.page}
              totalPages={reports.data.totalPages}
              onChange={(p) => setSearchParams({ ...(status !== 'open' ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) })}
            />
          </>
        )}
      </section>
    </>
  );
}
