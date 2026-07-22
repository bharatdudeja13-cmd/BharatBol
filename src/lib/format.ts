const inr = new Intl.NumberFormat('en-IN');

/** Indian-style grouping: 12,34,567 */
export const fmt = (n: number): string => inr.format(Math.max(0, Math.round(n)));

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
