import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../services/admin.service';
import { conversationsService } from '../services/conversations.service';
import { notificationsService } from '../services/notifications.service';
import type { UserRole } from '../types';
import type { NavItem } from '../features/auth/navigation';

export type NavCounters = Partial<Record<NonNullable<NavItem['badgeKey']>, number>>;

const REFRESH_MS = 60_000;

/** Small live counters for the sidebar; refreshed on navigation and every minute */
export function useNavCounters(role: UserRole): NavCounters {
  const location = useLocation();
  const [counters, setCounters] = useState<NavCounters>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [notifications, extra] = await Promise.allSettled([
        notificationsService.list(),
        role === 'admin'
          ? adminService.moderationQueue({ status: 'pending_review' }).then((r) => ({ pendingReview: r.total }))
          : conversationsService.list().then((list) => ({ unreadMessages: list.reduce((sum, c) => sum + c.unreadCount, 0) })),
      ]);
      if (!active) return;
      setCounters({
        unreadNotifications: notifications.status === 'fulfilled' ? notifications.value.filter((n) => !n.read).length : undefined,
        ...(extra.status === 'fulfilled' ? extra.value : {}),
      });
    };
    void load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [role, location.pathname]);

  return counters;
}
