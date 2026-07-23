/** India Standard Time calendar helpers for "today" metrics. */

const IST = 'Asia/Kolkata';

/** YYYY-MM-DD for an instant in IST. */
export function istDateKey(iso: string | Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  // en-CA yields ISO-like YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** True if `iso` falls on today's calendar date in IST. */
export function isIstToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const key = istDateKey(iso);
  return !!key && key === istDateKey(new Date());
}
