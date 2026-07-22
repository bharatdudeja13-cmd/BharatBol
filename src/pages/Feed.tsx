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
import { youtubeIdFromUrl } from '../lib/evidenceMedia';
import { EvidenceThumb } from '../components/EvidenceThumb';

function igEmbedPath(url: string): string | null {
  const m = url.match(/\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const kind = m[1] === 'p' ? 'p' : m[1] === 'tv' ? 'tv' : 'reel';
  return `${kind}/${m[2]}`;
}

/** Height above mobile BottomNav - reels never cover primary nav. */
const SLIDE_H =
  'h-[calc(100dvh-3.25rem-env(safe-area-inset-bottom))] md:h-[100dvh]';

/**
 * Feed = Instagram Explore / Reels. Full-bleed vertical evidence,
 * snap scroll, poster until embed ready, bottom nav always visible.
 * Grouped context by open stand / issue. No separate Watch destination.
 */
export default function Feed() {
  const [params, setParams] = useSearchParams();
  const issue = isIssueSlug(params.get('issue') ?? '') ? params.get('issue') : null;
  const state = params.get('state');
  const startId = params.get('id');
  const standParam = params.get('stand');

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
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  const standForIssue = useCallback(
    (slug: string) => stands.find((s) => s.category === slug) ?? null,
    [stands]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setReady({});
      const list = await loadEvidence({ issue, state, limit: 80 });
      if (cancelled) return;
      let next = list;
      if (standParam) {
        const st = stands.find((s) => s.id === standParam);
        if (st) next = list.filter((i) => i.issue === st.category);
      }

      let startIdx = 0;
      if (startId) {
        let idx = next.findIndex((i) => i.id === startId);
        if (idx < 0) {
          const orphan = list.find((i) => i.id === startId) ?? (await loadEvidenceById(startId));
          if (orphan) {
            next = [orphan, ...next.filter((i) => i.id !== orphan.id)];
            idx = 0;
          }
        }
        startIdx = idx < 0 ? 0 : idx;
      }

      setItems(next);
      setCounts(await loadReactionCounts(next.map((i) => i.id)));
      setActive(startIdx);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [issue, state, startId, standParam, stands]);

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

  useEffect(() => {
    if (loading || items.length === 0) return;
    const id = requestAnimationFrame(() => {
      slideRefs.current[active]?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length]);

  useEffect(() => {
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
        if (best && best.ratio >= 0.55) setActive(best.idx);
      },
      { root, threshold: [0.4, 0.55, 0.7, 0.85] }
    );
    for (const el of slideRefs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [items.length]);

  useEffect(() => {
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
  }, [muted, active]);

  const relatedStand = useMemo(() => {
    const item = items[active];
    if (!item) return null;
    return standForIssue(item.issue);
  }, [items, active, standForIssue]);

  const setFilter = (key: 'issue' | 'state', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('id');
    next.delete('stand');
    setParams(next, { replace: true });
    setFiltersOpen(false);
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
          const next = { ...cur };
          if (prevValue === 'up') next.ups = Math.max(0, next.ups - 1);
          if (prevValue === 'down') next.downs = Math.max(0, next.downs - 1);
          if (value === 'up') next.ups += 1;
          else next.downs += 1;
          return { ...prev, [item.id]: next };
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
        <h1 className="font-display font-bold text-2xl text-navy">{t('feed.title')}</h1>
        <p className="text-sub text-sm max-w-sm">{t('feed.empty')}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/add" className="btn-primary">
            + {t('nav.add')}
          </Link>
          {(issue || state) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setParams({}, { replace: true });
              }}
            >
              {t('feed.allIssues')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${SLIDE_H} bg-black text-white overflow-hidden`}>
      {/* Minimal chrome */}
      <header className="absolute top-0 inset-x-0 z-50 flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
        <button
          type="button"
          className="pointer-events-auto min-h-10 px-3 rounded-full bg-white/10 text-xs font-semibold backdrop-blur"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          {issue ? issueLabel(issue, lang) : t('feed.allIssues')}
          {state ? ` · ${stateName(state, lang)}` : ''}
        </button>
        <p className="text-[11px] font-mono truncate text-white/80 max-w-[40%] text-center">
          {relatedStand
            ? lang === 'hi' && relatedStand.title_hi
              ? relatedStand.title_hi
              : relatedStand.title
            : items[active]
              ? issueLabel(items[active].issue, lang)
              : t('feed.title')}
        </p>
        <button
          type="button"
          className="pointer-events-auto min-h-10 px-3 rounded-full bg-white/10 text-xs font-semibold backdrop-blur"
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? t('evidence.unmute') : t('evidence.mute')}
        </button>
      </header>

      {filtersOpen && (
        <div
          className="absolute inset-0 z-[55] bg-black/60 backdrop-blur-sm flex flex-col justify-end pointer-events-auto"
          onClick={(e) => e.target === e.currentTarget && setFiltersOpen(false)}
        >
          <div className="bg-bg text-ink rounded-t-3xl p-5 space-y-4 max-h-[70%] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg text-navy">{t('feed.title')}</h2>
              <Link to="/add" className="text-sm font-semibold text-navy underline underline-offset-4">
                + {t('nav.add')}
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold border ${
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
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold border ${
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
              className="w-full rounded-xl border border-line bg-faint px-4 py-2.5 text-sm"
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
        </div>
      )}

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
          const igPath = item.platform === 'instagram' ? igEmbedPath(item.url) : null;
          const embedReady = !!ready[item.id];
          const stand: Stand | null = standForIssue(item.issue);
          const stood = !!(stand && joined.has(stand.id));

          return (
            <section
              key={item.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-idx={idx}
              className="relative h-full w-full snap-start snap-always flex items-center justify-center bg-black"
            >
              <EvidenceThumb
                item={item}
                eager={near}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isActive && embedReady && (yid || igPath) ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {isActive && yid && (
                <iframe
                  ref={ytIframeRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200 ${
                    embedReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  src={`https://www.youtube-nocookie.com/embed/${yid}?autoplay=1&rel=0&playsinline=1&modestbranding=1&mute=1&enablejsapi=1&controls=0`}
                  title={item.title ?? 'YouTube'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  onLoad={() => setReady((r) => ({ ...r, [item.id]: true }))}
                />
              )}

              {isActive && igPath && (
                <iframe
                  className={`absolute inset-0 w-full h-full bg-transparent pointer-events-none transition-opacity duration-200 ${
                    embedReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  src={`https://www.instagram.com/${igPath}/embed/captioned/`}
                  title={item.title ?? 'Instagram'}
                  onLoad={() => setReady((r) => ({ ...r, [item.id]: true }))}
                />
              )}

              {isActive && item.platform === 'x' && (
                <div className="relative z-10 max-w-md mx-auto px-6 text-center space-y-4 pointer-events-auto">
                  <p className="text-lg leading-snug">{item.title}</p>
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="inline-flex btn-secondary text-sm">
                    {t('evidence.openOriginal')}
                  </a>
                </div>
              )}

              {/* Right-rail actions (thumb-driven) */}
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
