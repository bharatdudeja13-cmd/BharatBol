import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { useStands } from '../state/StandsProvider';
import { callFeedFn } from '../state/useFeed';
import {
  loadEvidence,
  loadEvidenceById,
  loadReactionCounts,
  type ReactionCounts,
} from '../state/useEvidence';
import { useI18n } from '../lib/i18n';
import { issueLabel, isIssueSlug, ISSUES } from '../config/issues';
import { stateName, STATES } from '../lib/states';
import { PLATFORM_LABEL } from '../lib/feedUrl';
import type { FeedItem, Stand } from '../lib/types';
import { isLive, supabase } from '../lib/supabase';
import { youtubeIdFromUrl, youtubeReelEmbedSrc } from '../lib/evidenceMedia';
import { EvidenceThumb } from '../components/EvidenceThumb';

/** Full-viewport reel height above BottomNav. */
const SLIDE_H =
  'h-[calc(100dvh-3.25rem-env(safe-area-inset-bottom))] md:h-[100dvh]';

/**
 * Feed = Instagram Explore:
 * 1) Gallery of previews (What India is seeing) — issue chips + submit CTA
 * 2) Tap a clip → vertical reels player (id= in URL); back restores gallery
 *
 * Playback strategy (no black flashes):
 * - Poster stays visible until the active embed reports ready
 * - YouTube: one nocookie iframe, autoplay + mute; tear down when off-slide
 * - Instagram: poster + open original (Meta embeds break in snap-scroll)
 * - X: poster card + open original (embeds are hostile)
 */
export default function Feed() {
  const [params, setParams] = useSearchParams();
  const issue = isIssueSlug(params.get('issue') ?? '') ? params.get('issue') : null;
  const state = params.get('state');
  const startId = params.get('id');
  const standParam = params.get('stand');
  const watching = !!startId;

  const { t, lang } = useI18n();
  const { session, signIn } = useAuth();
  const { stands, joined, requestStand } = useStands();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({});
  const [mine, setMine] = useState<Record<string, 'up' | 'down'>>({});
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Only the currently mounted active embed may flip this. */
  const [playReady, setPlayReady] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  const standForIssue = useCallback(
    (slug: string) => stands.find((s) => s.category === slug) ?? null,
    [stands]
  );

  const closePlayer = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('id');
    setParams(next, { replace: true });
    setPlayReady(false);
  }, [params, setParams]);

  const openPlayer = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set('id', id);
      setParams(next);
      setPlayReady(false);
    },
    [params, setParams]
  );

  // Load gallery list from filters only — changing watch id must not refetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPlayReady(false);
      const list = await loadEvidence({ issue, state, limit: 80 });
      if (cancelled) return;
      let next = list;
      if (standParam) {
        const st = stands.find((s) => s.id === standParam);
        if (st) next = list.filter((i) => i.issue === st.category);
      }
      setItems(next);
      setCounts(await loadReactionCounts(next.map((i) => i.id)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [issue, state, standParam, stands]);

  // Position player when id is set / list arrives.
  useEffect(() => {
    if (!startId || items.length === 0) return;
    const idx = items.findIndex((i) => i.id === startId);
    if (idx >= 0) {
      setActive(idx);
      return;
    }
    let cancelled = false;
    (async () => {
      const orphan = await loadEvidenceById(startId);
      if (cancelled || !orphan) return;
      setItems((prev) => {
        if (prev.some((i) => i.id === orphan.id)) return prev;
        return [orphan, ...prev];
      });
      setActive(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [startId, items]);

  useEffect(() => {
    if (!supabase || !session || items.length === 0) {
      setMine({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase!
        .from('feed_item_reactions')
        .select('feed_item_id,value')
        .eq('user_id', session.user.id)
        .in(
          'feed_item_id',
          items.map((i) => i.id)
        );
      if (cancelled) return;
      const m: Record<string, 'up' | 'down'> = {};
      for (const r of data ?? []) {
        if (r.value === 'up' || r.value === 'down') m[r.feed_item_id as string] = r.value;
      }
      setMine(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, items]);

  // New active slide → poster until that embed loads (prevents black flash).
  // Depend on `active` only — updating `id` in the URL after intersection must
  // not clear playReady after onLoad (that left the poster stuck forever).
  useEffect(() => {
    if (!watching) return;
    setPlayReady(false);
  }, [active, watching]);

  useEffect(() => {
    if (!watching || loading || items.length === 0) return;
    const id = requestAnimationFrame(() => {
      const idx = items.findIndex((i) => i.id === startId);
      const el = slideRefs.current[idx >= 0 ? idx : active];
      el?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(id);
    // Only re-snap when opening a clip, not on every intersection tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, loading, startId, items.length]);

  useEffect(() => {
    if (!watching) return;
    const root = scrollerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (!Number.isFinite(idx)) continue;
          if (!best || e.intersectionRatio > best.ratio) {
            best = { idx, ratio: e.intersectionRatio };
          }
        }
        if (best && best.ratio >= 0.55) {
          const idx = best.idx;
          setActive(idx);
          const item = items[idx];
          if (item && item.id !== startId) {
            const next = new URLSearchParams(params);
            next.set('id', item.id);
            setParams(next, { replace: true });
          }
        }
      },
      { root, threshold: [0.35, 0.55, 0.7, 0.85] }
    );
    for (const el of slideRefs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [watching, items, startId, params, setParams]);

  useEffect(() => {
    if (!watching) return;
    const frame = ytIframeRef.current;
    if (!frame?.contentWindow) return;
    const cmd = muted ? 'mute' : 'unMute';
    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: cmd, args: [] }),
        '*'
      );
    } catch {
      /* ignore */
    }
  }, [muted, active, watching, playReady]);

  useEffect(() => {
    if (!watching) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'j' && e.key !== 'k' && e.key !== 'Escape')
        return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'Escape') {
        closePlayer();
        return;
      }
      e.preventDefault();
      const dir = e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1;
      const next = Math.max(0, Math.min(items.length - 1, active + dir));
      if (next === active) return;
      setActive(next);
      slideRefs.current[next]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items.length, watching, closePlayer]);

  const relatedStand = useMemo(() => {
    const item = items[active];
    if (!item) return null;
    return standForIssue(item.issue);
  }, [items, active, standForIssue]);

  const setFilter = (key: 'issue' | 'state', value: string) => {
    const next = new URLSearchParams();
    if (key === 'issue') {
      if (value) next.set('issue', value);
      if (state) next.set('state', state);
    } else {
      if (issue) next.set('issue', issue);
      if (value) next.set('state', value);
    }
    if (standParam) next.set('stand', standParam);
    setParams(next, { replace: true });
  };

  const react = useCallback(
    async (item: FeedItem, value: 'up' | 'down') => {
      if (!isLive || !supabase) return;
      if (!session) {
        await signIn();
        return;
      }
      setBusyId(item.id);
      try {
        const prevValue = mine[item.id];
        const { error } = await supabase.from('feed_item_reactions').upsert(
          {
            user_id: session.user.id,
            feed_item_id: item.id,
            value,
          },
          { onConflict: 'user_id,feed_item_id' }
        );
        if (error) return;
        setMine((m) => ({ ...m, [item.id]: value }));
        setCounts((prev) => {
          const cur = prev[item.id] ?? { ups: 0, downs: 0 };
          const n = { ...cur };
          if (prevValue === 'up') n.ups = Math.max(0, n.ups - 1);
          if (prevValue === 'down') n.downs = Math.max(0, n.downs - 1);
          if (value === 'up') n.ups += 1;
          else n.downs += 1;
          return { ...prev, [item.id]: n };
        });
      } finally {
        setBusyId(null);
      }
    },
    [session, signIn, mine]
  );

  const report = async (item: FeedItem) => {
    if (!isLive) return;
    await callFeedFn('feed-report', { id: item.id, reason: 'other' });
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  };

  if (!watching) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-2xl text-navy truncate">{t('feed.title')}</h1>
            <p className="text-sm text-sub mt-1 leading-snug">{t('feed.subShort')}</p>
          </div>
          <Link
            to="/add"
            className="shrink-0 inline-flex items-center justify-center min-h-11 px-4 rounded-2xl bg-saffron text-navy text-sm font-bold shadow-lift whitespace-nowrap"
          >
            {t('feed.submitEvidence')}
          </Link>
        </div>
        <p className="text-xs text-sub leading-relaxed">{t('feed.submitHint')}</p>

        {/* Sticky chips + state — single compact bar so filters never blow the grid */}
        <div className="sticky top-16 z-30 -mx-4 px-4 py-2.5 space-y-2.5 bg-bg/95 backdrop-blur border-b border-line/70">
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            <button
              type="button"
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold border min-h-10 ${
                !issue ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
              }`}
              onClick={() => setFilter('issue', '')}
            >
              {t('feed.allIssues')}
            </button>
            {ISSUES.map((i) => (
              <button
                key={i.slug}
                type="button"
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold border min-h-10 ${
                  issue === i.slug ? 'bg-navy text-white border-navy' : 'bg-white text-sub border-line'
                }`}
                onClick={() => setFilter('issue', i.slug)}
              >
                {issueLabel(i.slug, lang)}
              </button>
            ))}
          </div>
          <select
            value={state ?? ''}
            onChange={(e) => setFilter('state', e.target.value)}
            className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
            aria-label={t('feed.allStates')}
          >
            <option value="">{t('feed.allStates')}</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {stateName(s.code, lang)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] rounded-2xl bg-faint border border-line animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-line bg-white p-8 text-center space-y-3">
            <p className="text-sub text-sm">{t('feed.empty')}</p>
            <Link to="/add" className="inline-flex btn-primary text-sm">
              {t('feed.submitEvidence')}
            </Link>
            <p className="text-xs text-sub">{t('feed.submitHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {items.map((item, i) => {
              const label = item.title?.trim() || issueLabel(item.issue, lang);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openPlayer(item.id)}
                  className="group relative rounded-2xl overflow-hidden border border-line text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                >
                  <EvidenceThumb item={item} eager={i < 6} className="aspect-[9/16]">
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 right-2 space-y-0.5">
                      <span className="block text-[10px] font-mono uppercase tracking-wide text-saffron">
                        {PLATFORM_LABEL[item.platform]}
                      </span>
                      <span className="block text-xs font-semibold text-white line-clamp-2 leading-snug">
                        {label}
                      </span>
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition bg-black/25">
                      <span className="rounded-full bg-saffron text-navy text-xs font-bold px-3 py-1.5">
                        {t('feed.play')}
                      </span>
                    </span>
                  </EvidenceThumb>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${SLIDE_H} bg-navyDeep text-white flex flex-col items-center justify-center gap-3 px-6`}>
        <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-saffron animate-spin" aria-hidden />
        <p className="text-sm text-white/70">{t('misc.loading')}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`${SLIDE_H} bg-bg flex flex-col items-center justify-center px-6 text-center space-y-4`}>
        <p className="text-sub text-sm">{t('feed.empty')}</p>
        <button type="button" className="btn-secondary" onClick={closePlayer}>
          {t('feed.backToGallery')}
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${SLIDE_H} bg-navyDeep text-white overflow-hidden`}>
      <header className="absolute top-0 inset-x-0 z-50 flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/80 to-transparent">
        <button
          type="button"
          className="shrink-0 min-h-10 min-w-10 rounded-full bg-white/15 text-sm font-bold backdrop-blur"
          onClick={closePlayer}
          aria-label={t('feed.backToGallery')}
        >
          ←
        </button>
        <p className="min-w-0 flex-1 text-center text-[11px] font-mono truncate text-white/85">
          {relatedStand
            ? lang === 'hi' && relatedStand.title_hi
              ? relatedStand.title_hi
              : relatedStand.title
            : items[active]
              ? issueLabel(items[active].issue, lang)
              : t('feed.title')}
          <span className="text-white/45">
            {' '}
            · {active + 1}/{items.length}
          </span>
        </p>
        <button
          type="button"
          className="shrink-0 min-h-10 px-3 rounded-full bg-white/15 text-xs font-semibold backdrop-blur"
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? t('evidence.unmute') : t('evidence.mute')}
        </button>
        <Link
          to="/add"
          className="shrink-0 min-h-10 min-w-10 flex items-center justify-center rounded-full bg-saffron text-navy text-lg font-bold"
          aria-label={t('feed.submitEvidence')}
          title={t('feed.submitEvidence')}
        >
          ＋
        </Link>
      </header>

      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overscroll-y-contain touch-pan-y"
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, idx) => {
          const isActive = idx === active;
          const near = Math.abs(idx - active) <= 1;
          const c = counts[item.id] ?? { ups: 0, downs: 0 };
          const my = mine[item.id];
          const yid = item.platform === 'youtube' ? youtubeIdFromUrl(item.url) : null;
          const stand: Stand | null = standForIssue(item.issue);
          const stood = !!(stand && joined.has(stand.id));
          // Only YouTube fully replaces the poster once play is ready.
          const hidePoster = isActive && playReady && !!yid;

          return (
            <section
              key={item.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-idx={idx}
              className={`relative w-full snap-start snap-always flex items-center justify-center bg-navyDeep ${SLIDE_H}`}
            >
              <EvidenceThumb
                item={item}
                eager={near}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  hidePoster ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              />

              {/* YouTube: one active iframe; always start muted for autoplay, unmute via JS API */}
              {isActive && yid && (
                <iframe
                  key={`yt-${item.id}`}
                  ref={ytIframeRef}
                  className={`absolute inset-0 w-full h-full border-0 pointer-events-none transition-opacity duration-200 ${
                    playReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  src={youtubeReelEmbedSrc(yid)}
                  title={item.title ?? 'YouTube'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  onLoad={() => {
                    setPlayReady(true);
                    if (!muted) {
                      try {
                        ytIframeRef.current?.contentWindow?.postMessage(
                          JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                          '*'
                        );
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                />
              )}

              {/* Instagram: poster + open original (Meta embeds break in snap-scroll) */}
              {isActive && item.platform === 'instagram' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 pointer-events-auto bg-gradient-to-t from-black/50 via-transparent to-transparent">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full bg-saffron text-navy text-sm font-bold px-5 py-3 shadow-lift"
                  >
                    {t('feed.openOn')} {PLATFORM_LABEL.instagram}
                  </a>
                </div>
              )}

              {/* X: card over poster — open original */}
              {isActive && item.platform === 'x' && (
                <div className="relative z-10 max-w-md mx-auto px-6 text-center space-y-4 pointer-events-auto">
                  <p className="text-lg leading-snug drop-shadow-md">{item.title}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex btn-secondary text-sm"
                  >
                    {t('evidence.openOriginal')}
                  </a>
                </div>
              )}

              <div className="absolute right-3 bottom-36 z-20 flex flex-col items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void react(item, 'up')}
                  className={`flex flex-col items-center min-w-[3rem] ${
                    my === 'up' ? 'text-saffron' : 'text-white'
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur text-lg font-bold border border-white/20">
                    ↑
                  </span>
                  <span className="mt-1 text-[10px] font-mono tabular-nums">{c.ups}</span>
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void react(item, 'down')}
                  className={`flex flex-col items-center min-w-[3rem] ${
                    my === 'down' ? 'text-saffron' : 'text-white'
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur text-lg font-bold border border-white/20">
                    ↓
                  </span>
                  <span className="mt-1 text-[10px] font-mono tabular-nums">{c.downs}</span>
                </button>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur text-sm border border-white/20"
                  aria-label={t('evidence.openOriginal')}
                >
                  ↗
                </a>
                <button
                  type="button"
                  onClick={() => void report(item)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur text-[10px] font-semibold border border-white/20"
                  aria-label={t('feed.report')}
                >
                  !
                </button>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-20 p-4 pr-16 pb-3 bg-gradient-to-t from-black/95 via-black/55 to-transparent space-y-2.5 pointer-events-auto">
                <p className="text-[10px] font-mono uppercase tracking-wide text-saffron">
                  {t('feed.unverified')} · {PLATFORM_LABEL[item.platform]}
                  {item.state ? ` · ${stateName(item.state, lang)}` : ` · ${t('add.allIndia')}`}
                </p>
                <p className="text-sm font-semibold line-clamp-2 leading-snug">
                  {item.title?.trim() || issueLabel(item.issue, lang)}
                </p>
                {stand && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isActive || stood) return;
                      void requestStand(stand);
                    }}
                    disabled={!isActive || stood}
                    className={`flex items-center justify-center min-h-12 w-full rounded-2xl px-4 py-3 text-base font-bold shadow-lift transition ${
                      stood
                        ? 'bg-white/15 text-white border border-white/35 cursor-default'
                        : 'bg-saffron text-navy'
                    }`}
                  >
                    {stood
                      ? t('evidence.iStoodUp')
                      : `${t('evidence.nowStand')}: ${
                          lang === 'hi' && stand.title_hi ? stand.title_hi : stand.title
                        }`}
                  </button>
                )}
                <p className="text-center text-[10px] text-white/35">{t('evidence.swipeHint')}</p>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
