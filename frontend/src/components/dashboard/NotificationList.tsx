import { Bell, BellRing, Sparkles, CheckCircle2, FileEdit, Flag, Hourglass, MessageSquare, TimerOff, TrendingDown, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AppNotification, NotificationType } from '../../types';
import { formatRelative } from '../../utils/format';
import { t } from '../../i18n';

const ICONS: Record<NotificationType, typeof Bell> = {
  listing_approved: CheckCircle2,
  changes_required: FileEdit,
  listing_rejected: XCircle,
  new_message: MessageSquare,
  report_update: Flag,
  system: Bell,
  saved_search_match: BellRing,
  price_drop: TrendingDown,
  listing_expiring: Hourglass,
  listing_expired: TimerOff,
  listing_featured: Sparkles,
};

interface NotificationListProps {
  notifications: AppNotification[];
  onOpen?: (notification: AppNotification) => void;
}

export function NotificationList({ notifications, onOpen }: NotificationListProps) {
  if (!notifications.length) return <p className="text-muted">{t('You are all caught up.')}</p>;
  return (
    <ul className="notification-list">
      {notifications.map((n) => {
        const Icon = ICONS[n.type];
        const content = (
          <>
            <span className={`notification-list__icon notification-list__icon--${n.type}`} aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className="notification-list__body">
              <div className="preview-list__row">
                <strong>{n.title}</strong>
                <span className="preview-list__time">{formatRelative(n.createdAt)}</span>
              </div>
              <p className="preview-list__text">{n.body}</p>
            </div>
            {!n.read && <span className="unread-dot" aria-label={t('Unread')} />}
          </>
        );
        return (
          <li key={n.id} className={n.read ? undefined : 'is-unread'}>
            {n.link ? (
              <Link to={n.link} className="notification-list__item" onClick={() => onOpen?.(n)}>
                {content}
              </Link>
            ) : (
              <button type="button" className="notification-list__item" onClick={() => onOpen?.(n)}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
