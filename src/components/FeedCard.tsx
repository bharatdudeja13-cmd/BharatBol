import { Link } from 'react-router-dom';
import type { FeedItem } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { issueLabel } from '../config/issues';
import { stateName } from '../lib/states';
import { PLATFORM_LABEL } from '../lib/feedUrl';
import { evidenceWatchPath } from '../state/useEvidence';
import { EvidenceThumb } from './EvidenceThumb';

/** Feed card / strip entry - playback opens Feed reels (/feed). */
export function FeedCard({
  item,
  onReport,
}: {
  item: FeedItem;
  onReport: (item: FeedItem) => void;
}) {
  const { t, lang } = useI18n();
  const watch = evidenceWatchPath({
    issue: item.issue,
    state: item.state,
    id: item.id,
  });
  const label = item.title?.trim() || issueLabel(item.issue, lang);

  return (
    <article className="card overflow-hidden">
      <Link to={watch} className="block relative aspect-[9/16] max-h-80 sm:aspect-video sm:max-h-none">
        <EvidenceThumb item={item} className="absolute inset-0" eager>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white/95 text-navy font-semibold px-5 py-2.5 shadow-lift">
              ▶ {t('evidence.watchAll')}
            </span>
          </span>
        </EvidenceThumb>
      </Link>

      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-navy/5 text-navy font-semibold px-2.5 py-1">
            {issueLabel(item.issue, lang)}
          </span>
          {item.state && (
            <span className="rounded-full bg-faint border border-line text-sub px-2.5 py-1">
              {stateName(item.state, lang)}
            </span>
          )}
          <span className="text-sub font-mono">{PLATFORM_LABEL[item.platform]}</span>
          <span className="text-sub font-mono">· {item.submitted_on}</span>
        </div>

        <h3 className="font-display font-semibold text-lg leading-snug">
          <Link to={watch} className="hover:text-navy">
            {label}
          </Link>
        </h3>
        {item.author_name && <p className="text-sm text-sub">{item.author_name}</p>}

        <p className="text-[11px] text-sub font-mono">⚠ {t('feed.unverified')}</p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link to={watch} className="btn-primary text-sm !py-2 !px-4">
            {t('evidence.watchAll')}
          </Link>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-sub underline underline-offset-4 hover:text-navy"
          >
            {t('evidence.openOriginal')} ↗
          </a>
          <button
            className="text-xs text-sub underline underline-offset-4 hover:text-navy"
            onClick={() => onReport(item)}
          >
            {t('feed.report')}
          </button>
        </div>
      </div>
    </article>
  );
}
