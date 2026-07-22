import { Link } from 'react-router-dom';
import type { FeedItem } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { issueLabel } from '../config/issues';
import { stateName } from '../lib/states';
import { evidenceWatchPath } from '../state/useEvidence';
import { EvidenceThumb } from './EvidenceThumb';

function scopeOf(item: FeedItem): 'state' | 'national' {
  return item.scope ?? (item.state ? 'state' : 'national');
}

/**
 * Horizontal evidence strip. Always shows a readable card even without a thumbnail.
 */
export function EvidenceStrip({
  items,
  issue,
  state,
  title,
  loading,
}: {
  items: FeedItem[];
  issue?: string | null;
  state?: string | null;
  title?: string;
  loading?: boolean;
}) {
  const { t, lang } = useI18n();

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-xl text-navy">{title ?? t('evidence.title')}</h2>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="shrink-0 w-36 sm:w-40 rounded-2xl border border-line bg-faint animate-pulse aspect-[9/16]"
            />
          ))}
        </div>
      </section>
    );
  }

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
          to={evidenceWatchPath({ issue, state })}
          className="text-sm font-semibold text-navy underline underline-offset-4 shrink-0"
        >
          {t('evidence.watchAll')}
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {items.map((item) => {
          const national = scopeOf(item) === 'national';
          const label = item.title?.trim() || issueLabel(item.issue, lang);
          return (
            <Link
              key={item.id}
              to={evidenceWatchPath({
                issue: issue ?? item.issue,
                state: state ?? item.state,
                id: item.id,
              })}
              className="snap-start shrink-0 w-36 sm:w-40 rounded-2xl overflow-hidden border border-line bg-faint"
            >
              <EvidenceThumb item={item} className="aspect-[9/16]">
                <span className="absolute bottom-2 left-2 right-2 text-[10px] font-mono text-white drop-shadow-md">
                  {issueLabel(item.issue, lang)}
                  {national
                    ? ` · ${t('add.allIndia')}`
                    : item.state
                      ? ` · ${stateName(item.state, lang)}`
                      : ''}
                </span>
              </EvidenceThumb>
              <p className="p-2 text-xs line-clamp-2 text-ink">{label}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
