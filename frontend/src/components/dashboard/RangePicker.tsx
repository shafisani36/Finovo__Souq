import { CalendarDays } from 'lucide-react';
import type { DashboardRange } from '../../services/dashboard.service';
import { Select } from '../ui/Select';
import { t } from '../../i18n';

const OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: t('Last 7 days') },
  { value: '30d', label: t('Last 30 days') },
  { value: '90d', label: t('Last 90 days') },
];

export function RangePicker({ value, onChange }: { value: DashboardRange; onChange: (value: DashboardRange) => void }) {
  return <Select className="range-select" value={value} onChange={(next) => onChange(next as DashboardRange)} options={OPTIONS} icon={<CalendarDays size={16} />} aria-label={t('Date range')} />;
}
