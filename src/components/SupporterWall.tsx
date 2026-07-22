import type { WallEntry } from '../lib/types';
import { stateName } from '../lib/states';
import { timeAgo } from '../lib/format';
import { useI18n } from '../lib/i18n';

export function SupporterWall({ entries, limit = 18 }: { entries: WallEntry[]; limit?: number }) {
  const { t, lang } = useI18n();
  const shown = entries.slice(0, limit);

  if (shown.length === 0) {
    return <p className="text-sm text-sub italic">{t('wall.empty')}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('wall.title')}>
      {shown.map((e, i) => (
        <li
          key={`${e.created_at}-${i}`}
          className="inline-flex items-center gap-2 rounded-full bg-faint border border-line px-3.5 py-1.5 text-sm"
        >
          <span className="font-semibold text-ink">{e.first_name}</span>
          {e.state && (
            <>
              <span className="text-sub" aria-hidden="true">·</span>
              <span className="text-sub">{stateName(e.state, lang)}</span>
            </>
          )}
          <span className="text-xs text-sub/70 font-mono">{timeAgo(e.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
