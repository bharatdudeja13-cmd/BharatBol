import { useState } from 'react';
import { evidencePoster } from '../lib/evidenceMedia';
import type { FeedItem } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { issueLabel } from '../config/issues';
import { PLATFORM_LABEL } from '../lib/feedUrl';

/**
 * Readable evidence poster. Never leaves an empty black box:
 * real thumbnail when available (incl. token-free Instagram /media/),
 * else a branded navy placeholder with platform + title/issue.
 * Broken CDN URLs fall back via onError.
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
  const [failed, setFailed] = useState(false);
  const src = failed ? null : evidencePoster(item);
  const label = item.title?.trim() || issueLabel(item.issue, lang);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-navyDeep via-[#12263f] to-[#0a1628] ${className}`}
    >
      {/* Placeholder always under the image so a failed load never flashes black-empty */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center">
        <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-saffron">
          {PLATFORM_LABEL[item.platform]}
        </span>
        <span className="text-xs sm:text-sm font-semibold leading-snug text-white/95 line-clamp-4">
          {label}
        </span>
        <span className="text-[10px] font-mono text-white/45 line-clamp-1">
          {issueLabel(item.issue, lang)}
        </span>
      </div>
      {src && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      {children}
    </div>
  );
}
