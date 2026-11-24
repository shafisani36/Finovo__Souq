import { useId, useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatCompact, formatNumber } from '../../utils/format';

export interface StackedSeries {
  name: string;
  color: string;
  /** Diagonal stripes, so the series is still told apart without colour */
  striped?: boolean;
}

interface StackedBarChartProps {
  data: { label: string; values: number[] }[];
  series: StackedSeries[];
  label: string;
  height?: number;
}

const TOP = 16;
const BOTTOM = 26;
const LEFT = 40;
const GAP = 2;

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value / 4)! * power;
  return Math.ceil(value / step) * step;
}

/** Vertical stacked bars with a recessive grid, a legend and a hover tooltip per bar */
export function StackedBarChart({ data, series, label, height = 240 }: StackedBarChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>(560);
  const [active, setActive] = useState<number | null>(null);
  const patternId = useId().replace(/:/g, '');

  const layout = useMemo(() => {
    const totals = data.map((d) => d.values.reduce((sum, v) => sum + v, 0));
    const max = niceMax(Math.max(...totals, 0));
    const innerW = Math.max(width - LEFT, 10);
    const innerH = height - TOP - BOTTOM;
    const slot = innerW / Math.max(data.length, 1);
    const barW = Math.max(4, Math.min(28, slot * 0.56));
    const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 54)));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ value: max * t, y: TOP + innerH - innerH * t }));
    const bars = data.map((d, i) => {
      const x = LEFT + slot * i + (slot - barW) / 2;
      let cursor = TOP + innerH;
      const segments = d.values.map((v, s) => {
        const h = (v / max) * innerH;
        const seg = { s, x, y: cursor - h, w: barW, h: Math.max(0, h - (s > 0 && h > GAP ? GAP : 0)) };
        cursor -= h;
        return seg;
      });
      return { ...d, x, cx: x + barW / 2, top: cursor, total: totals[i], segments, showLabel: i % labelEvery === 0 };
    });
    return { bars, ticks, slot, innerH };
  }, [data, width, height]);

  const current = active === null ? null : layout.bars[active];

  return (
    <div className="chart">
      <ul className="chart-legend">
        {series.map((s) => (
          <li key={s.name}>
            <span className={`chart-legend__swatch${s.striped ? ' chart-legend__swatch--striped' : ''}`} style={{ color: s.color }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
      <div ref={ref} className="chart__canvas">
        <svg width={width} height={height} role="img" aria-label={label} onMouseLeave={() => setActive(null)}>
          <defs>
            {series.map((s, i) =>
              s.striped ? (
                <pattern key={s.name} id={`${patternId}-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill={s.color} opacity="0.28" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={s.color} strokeWidth="2.4" />
                </pattern>
              ) : null,
            )}
          </defs>
          {layout.ticks.map((t) => (
            <g key={t.value}>
              <line x1={LEFT} x2={width} y1={t.y} y2={t.y} className="chart__grid" />
              <text x={LEFT - 8} y={t.y + 4} textAnchor="end" className="chart__axis">
                {formatCompact(t.value)}
              </text>
            </g>
          ))}
          {layout.bars.map((bar, i) => (
            <g key={`${bar.label}-${i}`} opacity={active === null || active === i ? 1 : 0.45}>
              {bar.segments.map((seg) =>
                seg.h > 0 ? (
                  <rect
                    key={seg.s}
                    x={seg.x}
                    y={seg.y}
                    width={seg.w}
                    height={seg.h}
                    rx={seg.s === bar.segments.length - 1 || bar.segments.slice(seg.s + 1).every((n) => n.h <= 0) ? 3 : 0}
                    fill={series[seg.s].striped ? `url(#${patternId}-${seg.s})` : series[seg.s].color}
                  />
                ) : null,
              )}
              {bar.showLabel && (
                <text x={bar.cx} y={height - 8} textAnchor="middle" className="chart__axis">
                  {bar.label}
                </text>
              )}
              <rect
                x={LEFT + layout.slot * i}
                y={TOP}
                width={layout.slot}
                height={layout.innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${bar.label}: ${series.map((s, n) => `${s.name} ${formatNumber(bar.values[n] ?? 0)}`).join(', ')}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          ))}
        </svg>
        {current && (
          <div className="chart__tooltip" style={{ left: current.cx, top: current.top - 10 }}>
            <span className="chart__tooltip-label">{current.label}</span>
            {series.map((s, n) => (
              <span key={s.name} className="chart__tooltip-row">
                <span className={`chart-legend__swatch${s.striped ? ' chart-legend__swatch--striped' : ''}`} style={{ color: s.color }} aria-hidden="true" />
                {s.name}
                <strong className="tabular">{formatNumber(current.values[n] ?? 0)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
