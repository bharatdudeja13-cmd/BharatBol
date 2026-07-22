import { stateName } from '../lib/states';
import { fmt } from '../lib/format';
import { useI18n } from '../lib/i18n';

/** Horizontal bars: top states standing for one Stand. */
export function StateBars({ rows, limit = 8 }: { rows: { state: string; count: number }[]; limit?: number }) {
  const { lang } = useI18n();
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, limit);
  const max = sorted[0]?.count ?? 0;
  if (max === 0) return null;

  return (
    <ul className="space-y-2">
      {sorted.map((r) => (
        <li key={r.state} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-sub truncate">{stateName(r.state, lang)}</span>
          <span className="h-2.5 rounded-full bg-line overflow-hidden">
            <span
              className="block h-full rounded-full bg-navy"
              style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-xs text-ink tabular-nums">{fmt(r.count)}</span>
        </li>
      ))}
    </ul>
  );
}
