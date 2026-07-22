import { Link } from 'react-router-dom';
import type { FeedItem } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { issueLabel } from '../config/issues';
import { stateName } from '../lib/states';
import { evidenceWatchPath } from '../state/useEvidence';
import { PLATFORM_LABEL } from '../lib/feedUrl';

function thumb(item: FeedItem): string | null {
  if (item.thumbnail_url) return item.thumbnail_url;
  if (item.platform === 'youtube') {
    try {
      const v = new URL(item.url).searchParams.get('v');
      if (v) return `https://i.ytimg.com/vi/${v}/hqdefault.jpg`;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Horizontal evidence strip for an issue (and optional state).
 * Tap opens the shorts-style player filtered to the same set.
 */
export function EvidenceStrip({
  items,
  issue,
  state,
  title,
}: {
  items: FeedItem[];
  issue?: string | null;
  state?: string | null;
  title?: string;
}) {
  const { t, lang } = useI18n();
  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display font-semibold text-xl text-navy">
            {title ?? t('evidence.title')}
          </h2>
          <Link to="/add" className="text-sm text-navy underline underline-offset-4">
            + {t('nav.add')}
          </Link>
        </div>
        <p className="text-sm text-sub">{t('evidence.empty')}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-xl text-navy">
            {title ?? t('evidence.title')}
          </h2>
          <p className="text-xs text-sub mt-0.5">{t('evidence.sub')}</p>
        </div>
        <Link
          to={evidenceWatchPath({ issue, state, id: items[0]?.id })}
          className="text-sm font-semibold text-navy underline underline-offset-4 shrink-0"
        >
          {t('evidence.watchAll')}
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {items.map((item) => {
          const src = thumb(item);
          return (
            <Link
              key={item.id}
              to={evidenceWatchPath({ issue: issue ?? item.issue, state: state ?? item.state, id: item.id })}
              className="snap-start shrink-0 w-36 sm:w-40 rounded-2xl overflow-hidden border border-line bg-faint"
            >
              <div className="relative aspect-[9/16] bg-navyDeep">
                {src ? (
                  <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/70 text-xs px-2 text-center">
                    {PLATFORM_LABEL[item.platform]}
                  </div>
                )}
                <span className="absolute bottom-2 left-2 right-2 text-[10px] font-mono text-white/90 drop-shadow">
                  {issueLabel(item.issue, lang)}
                  {item.state ? ` · ${stateName(item.state, lang)}` : ''}
                </span>
              </div>
              <p className="p-2 text-xs line-clamp-2 text-ink">{item.title ?? item.url}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
