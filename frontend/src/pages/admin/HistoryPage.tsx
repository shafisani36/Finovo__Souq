import { History } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { ModerationAction, ModerationLogEntry } from '../../types';
import { formatRelative } from '../../utils/format';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'listings', label: 'Ads' },
  { value: 'users', label: 'Accounts' },
];

const ACTIONS: Record<ModerationAction, { label: string; tone: BadgeTone }> = {
  listing_approved: { label: 'Ad approved', tone: 'success' },
  listing_changes_requested: { label: 'Changes requested', tone: 'warning' },
  listing_rejected: { label: 'Ad rejected', tone: 'danger' },
  listing_hidden: { label: 'Ad hidden', tone: 'danger' },
  seller_approved: { label: 'Seller approved', tone: 'success' },
  user_suspended: { label: 'Account suspended', tone: 'danger' },
  user_reactivated: { label: 'Account reactivated', tone: 'info' },
  listing_featured: { label: 'Ad featured', tone: 'primary' },
  listing_unfeatured: { label: 'Promotion stopped', tone: 'neutral' },
};

const statusLabel = (status: string) => status.replace(/_/g, ' ');

function Target({ entry }: { entry: ModerationLogEntry }) {
  if (entry.listing) return <Link to={`/listings/${entry.listing.id}`} className="link">{entry.listing.title}</Link>;
  if (entry.user) {
    return (
      <span>
        <span className="table-item__title">{entry.user.name}</span>
        <span className="table-item__meta">{entry.user.email}</span>
      </span>
    );
  }
  return <span className="text-muted">Deleted</span>;
}

/** Audit trail of admin decisions on ads and accounts */
export function HistoryPage() {
  useDocumentTitle('Activity log');
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type') ?? 'all';
  const page = Number(searchParams.get('page')) || 1;
  const history = useAsync(() => adminService.history({ type, page }), [type, page]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v && v !== 'all' ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every approval, rejection, hidden ad and account change, with who made it and why." />
      <section className="card">
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Show">
            {TABS.map((tab) => (
              <button key={tab.value} type="button" role="tab" aria-selected={type === tab.value} className="segmented__item" onClick={() => update({ type: tab.value, page: null })}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {history.error ? (
          <ErrorState error={history.error} onRetry={history.reload} />
        ) : history.isLoading || !history.data ? (
          <SkeletonBlock height={320} />
        ) : history.data.items.length === 0 ? (
          <EmptyState icon={<History size={26} />} title="Nothing here yet" text="Admin decisions will appear here as soon as they are made." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Ad or account</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Admin</th>
                    <th className="table__num">When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <Badge tone={ACTIONS[entry.action].tone}>{ACTIONS[entry.action].label}</Badge>
                      </td>
                      <td>
                        <Target entry={entry} />
                      </td>
                      <td className="text-muted history__status">
                        {statusLabel(entry.previousStatus)} → {statusLabel(entry.newStatus)}
                      </td>
                      <td className="history__reason">{entry.reason ?? <span className="text-muted">-</span>}</td>
                      <td>{entry.admin?.name ?? 'Former admin'}</td>
                      <td className="table__num" title={new Date(entry.createdAt).toLocaleString()}>
                        {formatRelative(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={history.data.page} totalPages={history.data.totalPages} onChange={(p) => update({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>
    </>
  );
}
