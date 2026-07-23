import { useEffect, useState } from 'react';
import { evidencePosterCandidates } from '../lib/evidenceMedia';
import type { FeedItem } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { issueLabel } from '../config/issues';
import { PLATFORM_LABEL } from '../lib/feedUrl';

/**
 * Readable evidence poster. Never leaves an empty / black box:
 * tries Worker proxy → stored thumbnail → platform CDN,
 * else a bright branded placeholder with platform + title/issue.
 */
export function EvidenceThumb({
  item,
  className = '',
  eager,
  children,
}: {
  item: FeedItem;
  className?: string;
  eager?: boolean;
  children?: React.ReactNode;
}) {
  const { lang } = useI18n();
  const candidates = evidencePosterCandidates(item);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [item.id, item.thumbnail_url, item.url]);
  const src = candidates[idx] ?? null;
  const label = item.title?.trim() || issueLabel(item.issue, lang);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#1a3358] via-[#243f66] to-[#0f2744] ${className}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center">
        <span className="rounded-full border border-saffron/50 bg-saffron/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-saffron">
          {PLATFORM_LABEL[item.platform]}
        </span>
        <span className="text-xs sm:text-sm font-semibold leading-snug text-white line-clamp-4">
          {label}
        </span>
        <span className="text-[10px] font-mono text-white/60 line-clamp-1">
          {issueLabel(item.issue, lang)}
        </span>
      </div>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIdx((i) => i + 1);
          }}
        />
      )}
      {children}
    </div>
  );
}
