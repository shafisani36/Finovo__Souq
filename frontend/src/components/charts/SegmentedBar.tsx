import { formatNumber } from '../../utils/format';

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Share of a whole as one horizontal bar, with a legend that repeats every value as text */
export function SegmentedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div className="segbar">
      <div className="segbar__track" role="img" aria-label={`${label}: ${visible.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        {total === 0 ? (
          <span className="segbar__empty" />
        ) : (
          visible.map((s) => <span key={s.label} className="segbar__part" style={{ flexGrow: s.value, background: s.color }} title={`${s.label}: ${formatNumber(s.value)}`} />)
        )}
      </div>
      <ul className="segbar__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="segbar__dot" style={{ background: s.color }} aria-hidden="true" />
            <span className="segbar__name">{s.label}</span>
            <strong className="tabular">{formatNumber(s.value)}</strong>
            <span className="segbar__share tabular">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
