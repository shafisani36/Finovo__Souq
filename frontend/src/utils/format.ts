import { CURRENCY } from '../config/app.config';
import type { KpiMetric, ListingStatus, ListingType } from '../types';
import { locale, t, tn } from '../i18n';

const numberFormatter = new Intl.NumberFormat(locale);
const compactFormatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

export function formatPrice(value: number, listingType?: ListingType, rentPeriod: 'year' | 'month' = 'year'): string {
  // "SAR 1,500" in English, "1,500 ر.س" in Arabic
  const amount = t('{currency} {amount}', { currency: t(CURRENCY), amount: numberFormatter.format(value) });
  if (listingType === 'rent') return t(rentPeriod === 'month' ? '{amount} / month' : '{amount} / year', { amount });
  return amount;
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatRelative(iso: string): string {
  const diffSeconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSeconds < 60) return t('Just now');
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return t('{minutes} min ago', { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('{hours} h ago', { hours });
  const days = Math.round(hours / 24);
  if (days < 7) return tn(days, '{count} day ago', '{count} days ago');
  return formatDate(iso);
}

export function formatKpiValue(metric: Pick<KpiMetric, 'value' | 'format'>): string {
  if (metric.format === 'currency') return `${CURRENCY} ${formatCompact(metric.value)}`;
  if (metric.format === 'percent') return `${metric.value}%`;
  return metric.value >= 10000 ? formatCompact(metric.value) : formatNumber(metric.value);
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: t('Draft'),
  pending_review: t('Pending review'),
  published: t('Live'),
  changes_required: t('Changes required'),
  rejected: t('Rejected'),
  hidden: t('Hidden'),
  withdrawn: t('Withdrawn'),
  expired: t('Expired'),
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  sale: t('For sale'),
  rent: t('For rent'),
  service: t('Service'),
};
