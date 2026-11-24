import {
  Bell,
  Flag,
  Heart,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PlusCircle,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../../types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Key used to show a live counter next to the item */
  badgeKey?: 'pendingReview' | 'unreadMessages' | 'unreadNotifications';
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const NAVIGATION: Record<UserRole, NavGroup[]> = {
  admin: [
    { title: 'Overview', items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard }] },
    {
      title: 'Listings',
      items: [
        { label: 'Moderation', to: '/admin/moderation', icon: ShieldCheck, badgeKey: 'pendingReview' },
        { label: 'Reports', to: '/admin/reports', icon: Flag },
      ],
    },
    { title: 'People', items: [{ label: 'Users', to: '/admin/users', icon: Users }] },
    {
      title: 'Account',
      items: [
        { label: 'Notifications', to: '/admin/notifications', icon: Bell, badgeKey: 'unreadNotifications' },
        { label: 'Profile', to: '/admin/profile', icon: UserCog },
      ],
    },
  ],
  user: [
    { title: 'Overview', items: [{ label: 'Dashboard', to: '/account/dashboard', icon: LayoutDashboard }] },
    {
      title: 'Selling',
      items: [
        { label: 'My ads', to: '/account/listings', icon: ListChecks },
        { label: 'Post an ad', to: '/account/listings/new', icon: PlusCircle },
      ],
    },
    {
      title: 'Buying',
      items: [
        { label: 'Browse ads', to: '/search', icon: Search },
        { label: 'Saved ads', to: '/account/saved', icon: Heart },
        { label: 'Messages', to: '/account/messages', icon: MessageSquare, badgeKey: 'unreadMessages' },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Notifications', to: '/account/notifications', icon: Bell, badgeKey: 'unreadNotifications' },
        { label: 'Profile', to: '/account/profile', icon: UserCog },
      ],
    },
  ],
};
