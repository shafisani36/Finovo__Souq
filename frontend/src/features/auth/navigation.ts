import {
  Bell,
  Flag,
  FolderTree,
  Heart,
  History,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Store,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../../types';
import { t } from '../../i18n';

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
  /** Shown only to approved seller accounts */
  sellerOnly?: boolean;
}

export const NAVIGATION: Record<UserRole, NavGroup[]> = {
  admin: [
    { title: t('Overview'), items: [{ label: t('Dashboard'), to: '/admin/dashboard', icon: LayoutDashboard }] },
    {
      title: t('Listings'),
      items: [
        { label: t('Moderation'), to: '/admin/moderation', icon: ShieldCheck, badgeKey: 'pendingReview' },
        { label: t('Categories'), to: '/admin/categories', icon: FolderTree },
        { label: t('Promotions'), to: '/admin/promotions', icon: Sparkles },
        { label: t('Reports'), to: '/admin/reports', icon: Flag },
        { label: t('Activity log'), to: '/admin/history', icon: History },
      ],
    },
    {
      title: t('People'),
      items: [
        { label: t('Users'), to: '/admin/users', icon: Users },
        { label: t('Stores'), to: '/admin/stores', icon: Store },
      ],
    },
    {
      title: t('Account'),
      items: [
        { label: t('Settings'), to: '/admin/settings', icon: Settings },
        { label: t('Notifications'), to: '/admin/notifications', icon: Bell, badgeKey: 'unreadNotifications' },
        { label: t('Profile'), to: '/admin/profile', icon: UserCog },
      ],
    },
  ],
  user: [
    { title: t('Overview'), items: [{ label: t('Dashboard'), to: '/account/dashboard', icon: LayoutDashboard }] },
    {
      title: t('Selling'),
      sellerOnly: true,
      items: [
        { label: t('My ads'), to: '/account/listings', icon: ListChecks },
        { label: t('Post an ad'), to: '/account/listings/new', icon: PlusCircle },
        { label: t('My store'), to: '/account/store', icon: Store },
      ],
    },
    {
      title: t('Buying'),
      items: [
        { label: t('Browse ads'), to: '/search', icon: Search },
        { label: t('Saved ads'), to: '/account/saved', icon: Heart },
        { label: t('Messages'), to: '/account/messages', icon: MessageSquare, badgeKey: 'unreadMessages' },
      ],
    },
    {
      title: t('Account'),
      items: [
        { label: t('Notifications'), to: '/account/notifications', icon: Bell, badgeKey: 'unreadNotifications' },
        { label: t('Profile'), to: '/account/profile', icon: UserCog },
      ],
    },
  ],
};
