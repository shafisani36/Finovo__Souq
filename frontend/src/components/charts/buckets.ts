import { formatShortDate } from '../../utils/format';

/**
 * Groups daily points into bars that stay readable: one bar per day up to 31 days, one per week beyond.
 */
export function bucketDaily<T extends { date: string }>(points: T[], keys: (keyof T)[]): { label: string; values: number[] }[] {
  const size = points.length > 31 ? 7 : 1;
  const buckets: { label: string; values: number[] }[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    buckets.push({
      label: formatShortDate(chunk[0].date),
      values: keys.map((key) => chunk.reduce((sum, p) => sum + Number(p[key] ?? 0), 0)),
    });
  }
  return buckets;
}
