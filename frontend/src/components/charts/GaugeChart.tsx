interface GaugeChartProps {
  value: number;
  label: string;
  caption?: string;
}

const R = 80;
const STROKE = 14;
const LENGTH = Math.PI * R;

/** A single 0-100 rate as a half-circle gauge with the number in the middle */
export function GaugeChart({ value, label, caption }: GaugeChartProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const path = `M ${STROKE / 2} ${R + STROKE / 2} A ${R} ${R} 0 0 1 ${2 * R + STROKE / 2} ${R + STROKE / 2}`;
  return (
    <div className="gauge" role="meter" aria-label={label} aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox={`0 0 ${2 * R + STROKE} ${R + STROKE}`} aria-hidden="true">
        <path d={path} className="gauge__track" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        {clamped > 0 && <path d={path} className="gauge__fill" strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${(clamped / 100) * LENGTH} ${LENGTH}`} />}
      </svg>
      <div className="gauge__center">
        <strong className="tabular">{clamped}%</strong>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}
