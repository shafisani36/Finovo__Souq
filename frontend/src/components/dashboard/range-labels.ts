import type { DashboardRange } from '../../services/dashboard.service';
import { t } from '../../i18n';

export const RANGE_LABEL: Record<DashboardRange, string> = {
  '7d': t('vs last 7 days'),
  '30d': t('vs last 30 days'),
  '90d': t('vs last 90 days'),
};
