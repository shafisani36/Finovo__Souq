import type { ReactNode } from 'react';
import { CheckCircle2, CircleDashed, Clock, EyeOff, FileEdit, Undo2, XCircle } from 'lucide-react';
import type { ListingAvailability, ListingStatus, ReportStatus, UserStatus } from '../../types';
import { LISTING_STATUS_LABELS } from '../../utils/format';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export function Badge({ tone = 'neutral', children, icon }: { tone?: BadgeTone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`badge${tone === 'neutral' ? '' : ` badge--${tone}`}`}>
      {icon}
      {children}
    </span>
  );
}

const STATUS_META: Record<ListingStatus, { tone: BadgeTone; icon: ReactNode }> = {
  draft: { tone: 'neutral', icon: <CircleDashed size={12} /> },
  pending_review: { tone: 'warning', icon: <Clock size={12} /> },
  published: { tone: 'success', icon: <CheckCircle2 size={12} /> },
  changes_required: { tone: 'info', icon: <FileEdit size={12} /> },
  rejected: { tone: 'danger', icon: <XCircle size={12} /> },
  hidden: { tone: 'danger', icon: <EyeOff size={12} /> },
  withdrawn: { tone: 'neutral', icon: <Undo2 size={12} /> },
};

export function ListingStatusBadge({ status, availability }: { status: ListingStatus; availability?: ListingAvailability }) {
  if (status === 'published' && availability && availability !== 'available') {
    return (
      <Badge tone="primary" icon={<CheckCircle2 size={12} />}>
        {availability === 'sold' ? 'Sold' : 'Rented'}
      </Badge>
    );
  }
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {LISTING_STATUS_LABELS[status]}
    </Badge>
  );
}

const USER_STATUS: Record<UserStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting for approval' },
  active: { tone: 'success', label: 'Active' },
  suspended: { tone: 'danger', label: 'Suspended' },
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={USER_STATUS[status].tone}>{USER_STATUS[status].label}</Badge>;
}

const REPORT_STATUS: Record<ReportStatus, { tone: BadgeTone; label: string }> = {
  open: { tone: 'danger', label: 'Open' },
  reviewing: { tone: 'warning', label: 'Reviewing' },
  resolved: { tone: 'success', label: 'Resolved' },
  dismissed: { tone: 'neutral', label: 'Dismissed' },
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={REPORT_STATUS[status].tone}>{REPORT_STATUS[status].label}</Badge>;
}
