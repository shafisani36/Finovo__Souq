import type { DashboardRange } from '../../services/dashboard.service';

export const RANGE_LABEL: Record<DashboardRange, string> = {
  '7d': 'vs last 7 days',
  '30d': 'vs last 30 days',
  '90d': 'vs last 90 days',
};
