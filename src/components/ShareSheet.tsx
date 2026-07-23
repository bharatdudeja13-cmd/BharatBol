import { useEffect, useMemo, useState } from 'react';
import { useStands } from '../state/StandsProvider';
import { useI18n } from '../lib/i18n';
import { SITE_URL } from '../lib/supabase';
import { fmt } from '../lib/format';
import { drawProofCard, shareCanvas, downloadCanvas, type CardFormat } from '../lib/cards';
import { autoTag, hashtagBlock } from '../lib/campaign';
import { SHARE_TEMPLATES, fillTemplate } from '../config/brand';

/**
 * The one-tap share package: card image (post or story format),
 * prewritten caption (editable), and dedicated WhatsApp / X / Instagram
 * buttons. All copy comes from SHARE_TEMPLATES — issue-framed only.
 */
export function ShareSheet() {
  const { shareFor, setShareFor, counts, joined } = useStands();
  const { t, lang } = useI18n();
  const copyLang = lang === 'hi' ? 'hi' : 'en';
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [format, setFormat] = useState<CardFormat>('portrait');
  const [caption, setCaption] = useState('');
  const [copied, setCopied] = useState<'' | 'link' | 'caption' | 'insta'>('');

  const count = shareFor ? counts[shareFor.id]?.total ?? 0 : 0;
  const title = shareFor ? (lang === 'hi' && shareFor.title_hi ? shareFor.title_hi : shareFor.title) : '';
  const link = shareFor ? `${SITE_URL}/stand/${shareFor.id}` : SITE_URL;
  const isJoined = shareFor ? joined.has(shareFor.id) : false;

  const vars = useMemo(
    () =>
      shareFor
        ? { issue: title, n: fmt(count), link, tag: `#${autoTag(shareFor)}` }
        : { issue: '', n: '', link: '', tag: '' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shareFor, title, link]
  );

  // Reset caption when the sheet opens or language flips.
  useEffect(() => {
    if (shareFor) setCaption(fillTemplate(SHARE_TEMPLATES.caption[copyLang], vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareFor, copyLang]);

  // (Re)draw the card when the sheet opens or the format changes.
  useEffect(() => {
    if (!shareFor) {
      setCanvas(null);
      setDataUrl('');
      setFormat('portrait');
      return;
    }
    let cancelled = false;
    setCopied('');
    void drawProofCard({
      count,
      title: shareFor.title,
      url: link,
      hashtags: hashtagBlock(shareFor),
      format,
    }).then((c) => {
      if (cancelled) return;
      setCanvas(c);
      setDataUrl(c.toDataURL('image/png'));
    });
    return () => {
      cancelled = true;
    };
    // Intentionally not re-rendering on every live count tick while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareFor, format]);

  if (!shareFor) return null;

  const filename = format === 'story' ? 'bharatbol-story.png' : 'bharatbol-stand.png';

  const doShare = async () => {
    // Web Share adds `url` separately. Remove the same stand link from the
    // text so recipients see one canonical link, not two.
    const text = caption.replace(link, '').replace(/\s{2,}/g, ' ').trim();
    if (canvas && (await shareCanvas(canvas, text, link))) return;
    if (canvas) downloadCanvas(canvas, filename);
  };

  const copyText = async (text: string, which: 'link' | 'caption' | 'insta') => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    window.setTimeout(() => setCopied(''), 2500);
  };

  const doInstagram = async () => {
    // Instagram has no web share intent: copy the caption, save the card.
    await copyText(caption, 'insta');
    if (canvas) downloadCanvas(canvas, filename);
  };

  const waText = fillTemplate(SHARE_TEMPLATES.whatsapp[copyLang], vars);
  const xText = fillTemplate(SHARE_TEMPLATES.x[copyLang], vars);

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
              {isJoined ? t('share.title') : t('share.startTitle')}
            </h2>
            <p className="text-sm text-sub mt-0.5">{isJoined ? t('share.sub') : t('campaign.line')}</p>
          </div>
          <button className="btn-ghost !min-h-0 !px-3 !py-1 text-sub" onClick={() => setShareFor(null)} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="font-mono text-sm font-semibold text-saffron">{hashtagBlock(shareFor)}</p>
        <a
          href={`${SITE_URL}/ledger`}
          className="inline-flex text-sm font-semibold text-navy underline underline-offset-4"
        >
          {t('share.publicRecord')} →
        </a>

        {/* Format toggle: feed post vs story/DP */}
        <div className="flex gap-2" role="radiogroup" aria-label="Card format">
          {(['portrait', 'story'] as CardFormat[]).map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={format === f}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                format === f ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line hover:text-navy'
              }`}
              onClick={() => setFormat(f)}
            >
              {f === 'portrait' ? t('share.formatPost') : t('share.formatStory')}
            </button>
          ))}
        </div>

        {dataUrl ? (
          <img
            src={dataUrl}
            alt={caption}
            className={`rounded-xl shadow-lift ${format === 'story' ? 'w-2/3 mx-auto' : 'w-full'}`}
          />
        ) : (
          <div className={`rounded-xl bg-faint animate-pulse ${format === 'story' ? 'aspect-[9/16] w-2/3 mx-auto' : 'aspect-[4/5] w-full'}`} />
        )}

        {/* Editable caption */}
        <label className="block">
          <span className="text-xs font-semibold text-sub uppercase tracking-wide">{t('share.caption')}</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-line bg-faint px-3 py-2 text-sm leading-relaxed"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button className="btn-primary col-span-2" onClick={() => void doShare()}>
            {t('share.button')}
          </button>
          <a
            className="btn-secondary text-sm"
            href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('share.whatsapp')}
          </a>
          <a
            className="btn-secondary text-sm"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('share.x')}
          </a>
          <button className="btn-secondary text-sm" onClick={() => void doInstagram()}>
            {copied === 'insta' ? '✓ ' + t('share.instagramHint') : t('share.instagram')}
          </button>
          <button className="btn-secondary text-sm" onClick={() => canvas && downloadCanvas(canvas, filename)}>
            {t('share.download')}
          </button>
          <button className="btn-ghost text-sm" onClick={() => void copyText(caption, 'caption')}>
            {copied === 'caption' ? '✓ ' + t('share.captionCopied') : t('share.copyCaption')}
          </button>
          <button className="btn-ghost text-sm" onClick={() => void copyText(link, 'link')}>
            {copied === 'link' ? '✓ ' + t('share.copied') : t('share.copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
