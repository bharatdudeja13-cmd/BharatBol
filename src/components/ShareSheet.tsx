import { useEffect, useState } from 'react';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { SITE_URL } from '../lib/supabase';
import { fmt } from '../lib/format';
import { drawProofCard, shareCanvas, downloadCanvas } from '../lib/cards';

/**
 * Appears right after a citizen stands: their proof card, ready to share.
 * This is the growth engine — one tap from counted to shared.
 */
export function ShareSheet() {
  const { shareFor, setShareFor, counts } = useStands();
  const { t, lang } = useI18n();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const count = shareFor ? counts[shareFor.id]?.total ?? 0 : 0;
  const title = shareFor ? (lang === 'hi' && shareFor.title_hi ? shareFor.title_hi : shareFor.title) : '';
  const link = shareFor ? `${SITE_URL}/stand/${shareFor.id}` : SITE_URL;
  const shareText = shareFor
    ? `I'm 1 of ${fmt(count)} standing for: ${title}. Where do you stand?`
    : '';

  useEffect(() => {
    if (!shareFor) {
      setCanvas(null);
      setDataUrl('');
      return;
    }
    let cancelled = false;
    setCopied(false);
    void drawProofCard({ count, title: shareFor.title, url: link }).then((c) => {
      if (cancelled) return;
      setCanvas(c);
      setDataUrl(c.toDataURL('image/png'));
    });
    return () => {
      cancelled = true;
    };
    // Intentionally not re-rendering on every live count tick while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareFor]);

  if (!shareFor) return null;

  const doShare = async () => {
    if (canvas && (await shareCanvas(canvas, shareText, link))) return;
    if (canvas) downloadCanvas(canvas, 'bharatbol-stand.png');
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${shareText} ${link}`);
    setCopied(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-navyDeep/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onClick={(e) => e.target === e.currentTarget && setShareFor(null)}
    >
      <div className="card w-full max-w-md p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-title" className="font-display font-semibold text-xl text-navy">
              {t('share.title')}
            </h2>
            <p className="text-sm text-sub mt-0.5">{t('share.sub')}</p>
          </div>
          <button className="btn-ghost !min-h-0 !px-3 !py-1 text-sub" onClick={() => setShareFor(null)} aria-label="Close">
            ✕
          </button>
        </div>

        {dataUrl ? (
          <img src={dataUrl} alt={shareText} className="w-full rounded-xl shadow-lift" />
        ) : (
          <div className="aspect-[4/5] w-full rounded-xl bg-faint animate-pulse" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <button className="btn-primary col-span-2" onClick={() => void doShare()}>
            {t('share.button')}
          </button>
          <a
            className="btn-secondary text-sm"
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('share.whatsapp')}
          </a>
          <button className="btn-secondary text-sm" onClick={() => canvas && downloadCanvas(canvas, 'bharatbol-stand.png')}>
            {t('share.download')}
          </button>
          <button className="btn-ghost col-span-2 text-sm" onClick={() => void copy()}>
            {copied ? '✓ ' + t('share.copied') : t('share.copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
