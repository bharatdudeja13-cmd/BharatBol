import { useState } from 'react';
import type { FeedItem } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { issueLabel } from '../config/issues';
import { stateName } from '../lib/states';
import { PLATFORM_LABEL } from '../lib/feedUrl';

/**
 * One feed item. Link + embed only — BharatBol never re-hosts media.
 *
 * YouTube uses the official privacy-enhanced player, and only after the
 * viewer taps: no third-party request is made just by scrolling past.
 * X and Instagram render as titled link-cards that open the original
 * (Instagram thumbnails need a Facebook app token we do not assume).
 * Every card carries source, date and the "unverified" label.
 */
export function FeedCard({
  item,
  onReport,
}: {
  item: FeedItem;
  onReport: (item: FeedItem) => void;
}) {
  const { t, lang } = useI18n();
  const [playing, setPlaying] = useState(false);

  const ytId =
    item.platform === 'youtube' ? new URL(item.url).searchParams.get('v') : null;

  return (
    <article className="card overflow-hidden">
      {item.platform === 'youtube' && ytId ? (
        <div className="relative aspect-video bg-navyDeep">
          {playing ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
              title={item.title ?? 'YouTube'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              className="absolute inset-0 w-full h-full flex items-center justify-center group"
              onClick={() => setPlaying(true)}
              aria-label={`${t('feed.play')}: ${item.title ?? ''}`}
            >
              <img
                src={item.thumbnail_url ?? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-90"
                loading="lazy"
              />
              <span className="relative z-10 rounded-full bg-white/95 text-navy font-semibold px-5 py-2.5 shadow-lift group-hover:scale-105 transition">
                ▶ {t('feed.play')}
              </span>
            </button>
          )}
        </div>
      ) : null}

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

        {item.title && (
          <h3 className="font-display font-semibold text-lg leading-snug">{item.title}</h3>
        )}
        {item.author_name && (
          <p className="text-sm text-sub">{item.author_name}</p>
        )}

        <p className="text-[11px] text-sub font-mono">⚠ {t('feed.unverified')}</p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-secondary text-sm !py-2 !px-4"
          >
            {t('feed.openOn')} {PLATFORM_LABEL[item.platform]} ↗
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
