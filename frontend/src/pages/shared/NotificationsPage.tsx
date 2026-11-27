import { useMemo, useState } from 'react';
import { Bell, BellRing, Sparkles, CheckCheck, CheckCircle2, ChevronRight, FileEdit, Flag, Hourglass, MessageSquare, TimerOff, TrendingDown, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { notificationsService } from '../../services/notifications.service';
import type { AppNotification, NotificationType } from '../../types';
import { formatRelative, formatTime } from '../../utils/format';
import { t, tn } from '../../i18n';

const TYPE_META: Record<NotificationType, { icon: typeof Bell; label: string }> = {
  listing_approved: { icon: CheckCircle2, label: t('Ad approved') },
  changes_required: { icon: FileEdit, label: t('Needs changes') },
  listing_rejected: { icon: XCircle, label: t('Ad rejected') },
  new_message: { icon: MessageSquare, label: t('Message') },
  report_update: { icon: Flag, label: t('Report') },
  system: { icon: Bell, label: t('Update') },
  saved_search_match: { icon: BellRing, label: t('Search alert') },
  price_drop: { icon: TrendingDown, label: t('Price drop') },
  listing_expiring: { icon: Hourglass, label: t('Expiring soon') },
  listing_expired: { icon: TimerOff, label: t('Ad expired') },
  listing_featured: { icon: Sparkles, label: t('Featured') },
};

type Filter = 'all' | 'unread';

const DAY_MS = 24 * 60 * 60 * 1000;

function groupLabel(iso: string): string {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const time = new Date(iso).getTime();
  if (time >= startOfToday.getTime()) return 'Today';
  if (time >= startOfToday.getTime() - DAY_MS) return 'Yesterday';
  if (time >= startOfToday.getTime() - 6 * DAY_MS) return t('This week');
  return 'Earlier';
}

export function NotificationsPage() {
  useDocumentTitle(t('Notifications'));
  const navigate = useNavigate();
  const toast = useToast();
  const notifications = useAsync(() => notificationsService.list(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const all = notifications.data ?? [];
  const unreadCount = all.filter((n) => !n.read).length;

  const groups = useMemo(() => {
    const visible = (notifications.data ?? []).filter((n) => filter === 'all' || !n.read);
    const sorted = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted.reduce<{ label: string; items: AppNotification[] }[]>((acc, n) => {
      const label = groupLabel(n.createdAt);
      const last = acc[acc.length - 1];
      if (last && last.label === label) last.items.push(n);
      else acc.push({ label, items: [n] });
      return acc;
    }, []);
  }, [notifications.data, filter]);

  const markRead = (ids: string[]) => {
    notifications.setData((prev) => prev?.map((x) => (ids.includes(x.id) ? { ...x, read: true } : x)) ?? null);
  };

  const open = (n: AppNotification) => {
    if (!n.read) {
      markRead([n.id]);
      // Read state is not critical; a failed update simply shows as unread next time
      notificationsService.markRead(n.id).catch(() => undefined);
    }
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    const ids = all.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setMarkingAll(true);
    try {
      await notificationsService.markAllRead();
      markRead(ids);
    } catch {
      toast.show({ title: t('Notifications could not be updated'), tone: 'error' });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('Notifications')}
        subtitle={notifications.data ? (unreadCount ? tn(unreadCount, 'You have {count} unread notification', 'You have {count} unread notifications') : t('You are all caught up')) : undefined}
        actions={
          <Button icon={<CheckCheck size={16} />} onClick={markAllRead} isLoading={markingAll} disabled={!unreadCount}>
            {t('Mark all as read')}
          </Button>
        }
      />

      <section className="card notif">
        <div className="notif__toolbar">
          <div className="segmented" role="tablist" aria-label={t('Filter notifications')}>
            <button type="button" role="tab" aria-selected={filter === 'all'} className="segmented__item" onClick={() => setFilter('all')}>
              {t('All')}
              <span className="segmented__count">{all.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={filter === 'unread'} className="segmented__item" onClick={() => setFilter('unread')}>
              {t('Unread')}
              <span className="segmented__count">{unreadCount}</span>
            </button>
          </div>
        </div>

        {notifications.error ? (
          <ErrorState error={notifications.error} onRetry={notifications.reload} />
        ) : notifications.isLoading || !notifications.data ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonBlock key={i} height={72} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Bell size={26} />}
            title={filter === 'unread' ? t('Nothing unread') : t('No notifications yet')}
            text={filter === 'unread' ? t('New updates about your ads and messages will show up here.') : t('Updates about your ads and messages will appear here.')}
          />
        ) : (
          groups.map((group) => (
            <div key={group.label} className="notif__group">
              <h2 className="notif__group-title">{group.label}</h2>
              <ul className="notif__list">
                {group.items.map((n) => {
                  const meta = TYPE_META[n.type];
                  const Icon = meta.icon;
                  return (
                    <li key={n.id}>
                      <button type="button" className={`notif__item${n.read ? '' : ' is-unread'}`} onClick={() => open(n)}>
                        <span className={`notif__icon notif__icon--${n.type}`} aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <span className="notif__body">
                          <span className="notif__top">
                            <strong>{n.title}</strong>
                            <span className="notif__tag">{meta.label}</span>
                          </span>
                          <span className="notif__text">{n.body}</span>
                          <time className="notif__time" dateTime={n.createdAt} title={formatTime(n.createdAt)}>
                            {formatRelative(n.createdAt)}
                          </time>
                        </span>
                        {!n.read && <span className="notif__dot" aria-label={t('Unread')} />}
                        {n.link && <ChevronRight size={18} className="notif__chevron" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
