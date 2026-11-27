import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { KpiMetric } from '../../types';
import { formatKpiValue, percentChange } from '../../utils/format';
import { t } from '../../i18n';

interface StatCardProps {
  metric: KpiMetric;
  icon: ReactNode;
  /** For metrics like "open reports", going up is bad */
  higherIsBetter?: boolean;
  periodLabel?: string;
}

export function StatCard({ metric, icon, higherIsBetter = true, periodLabel = 'vs last period' }: StatCardProps) {
  const change = percentChange(metric.value, metric.previousValue);
  const direction = change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
  const good = direction === 'flat' ? null : (direction === 'up') === higherIsBetter;
  const tone = good === null ? 'flat' : good ? 'up' : 'down';
  const Arrow = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <div className="stat-card">
      <div className="stat-card__top">
        <span className="stat-card__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="stat-card__label">{metric.label}</span>
      </div>
      <strong className="stat-card__value tabular">{formatKpiValue(metric)}</strong>
      <div className="stat-card__foot">
        <span className={`delta delta--${tone}`}>
          <Arrow size={12} aria-hidden="true" />
          {change === null ? t('New') : `${Math.abs(change)}%`}
        </span>
        <span className="stat-card__meta">{periodLabel}</span>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card" aria-hidden="true">
      <div className="skeleton" style={{ height: 32, width: '55%' }} />
      <div className="skeleton" style={{ height: 30, width: '45%', marginTop: 16 }} />
      <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 14 }} />
    </div>
  );
}
