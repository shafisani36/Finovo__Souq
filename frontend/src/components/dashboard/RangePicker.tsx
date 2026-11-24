import { CalendarDays } from 'lucide-react';
import type { DashboardRange } from '../../services/dashboard.service';
import { Select } from '../ui/Select';

const OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export function RangePicker({ value, onChange }: { value: DashboardRange; onChange: (value: DashboardRange) => void }) {
  return (
    <Select
      className="range-select"
      value={value}
      onChange={(next) => onChange(next as DashboardRange)}
      options={OPTIONS}
      icon={<CalendarDays size={16} />}
      aria-label="Date range"
    />
  );
}
