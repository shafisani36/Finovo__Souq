import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../services/admin.service';
import { conversationsService } from '../services/conversations.service';
import { notificationsService } from '../services/notifications.service';
import type { UserRole } from '../types';
import type { NavItem } from '../features/auth/navigation';
import { useSocketEvent } from '../features/realtime/realtime-context';

export type NavCounters = Partial<Record<NonNullable<NavItem['badgeKey']>, number>>;

const REFRESH_MS = 5 * 60_000;

/** Sidebar counters: loaded on navigation and every few minutes, and updated live from the socket */
export function useNavCounters(role: UserRole, userId: string | undefined): NavCounters {
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

  useSocketEvent('notification:new', () => setCounters((c) => ({ ...c, unreadNotifications: (c.unreadNotifications ?? 0) + 1 })));
  useSocketEvent('message:new', ({ message }) => {
    if (message.senderId !== userId) setCounters((c) => ({ ...c, unreadMessages: (c.unreadMessages ?? 0) + 1 }));
  });
  // Reading a conversation clears its messages from the total, so ask the server for the new number
  useSocketEvent('conversation:read', ({ readerId }) => {
    if (readerId === userId) void conversationsService.list().then((list) => setCounters((c) => ({ ...c, unreadMessages: list.reduce((sum, x) => sum + x.unreadCount, 0) })));
  });

  return counters;
}
