import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../state/AuthProvider';
import { useStands } from '../state/StandsProvider';
import { callFeedFn } from '../state/useFeed';
import {
  loadEvidence,
  loadReactionCounts,
  type ReactionCounts,
} from '../state/useEvidence';
import { useI18n } from '../lib/i18n';
import { issueLabel, isIssueSlug } from '../config/issues';
import { stateName } from '../lib/states';
import { PLATFORM_LABEL } from '../lib/feedUrl';
import type { FeedItem, Stand } from '../lib/types';
import { isLive, supabase } from '../lib/supabase';
import { fmt } from '../lib/format';
import { evidencePoster } from '../lib/evidenceMedia';

function ytId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

function igId(url: string): string | null {
  const m = url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** Full-viewport shorts player. Iframes are pointer-events-none so vertical scroll works. */
export default function EvidencePlayer() {
  const [params] = useSearchParams();
  const issue = isIssueSlug(params.get('issue') ?? '') ? params.get('issue') : null;
  const state = params.get('state');
  const startId = params.get('id');
  const standParam = params.get('stand');

  const { t, lang } = useI18n();
  const { session, signIn } = useAuth();
  const { stands, counts: standCounts } = useStands();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({});
  const [mine, setMine] = useState<Record<string, 'up' | 'down'>>({});
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [browsing, setBrowsing] = useState(!startId);
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
      const list = await loadEvidence({ issue, state, limit: 60 });
      if (cancelled) return;
      let next = list;
      if (standParam) {
        const st = stands.find((s) => s.id === standParam);
        if (st) next = list.filter((i) => i.issue === st.category);
      }
      setItems(next);
      setCounts(await loadReactionCounts(next.map((i) => i.id)));
      const idx = startId ? Math.max(0, next.findIndex((i) => i.id === startId)) : 0;
      setActive(idx < 0 ? 0 : idx);
      setBrowsing(!startId && !standParam);
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
    if (loading || browsing || items.length === 0) return;
    slideRefs.current[active]?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, browsing]);

  useEffect(() => {
    if (browsing) return;
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
  }, [items.length, browsing]);

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

  const groups = useMemo(() => {
    const map = new Map<string, { stand: Stand | null; issue: string; items: FeedItem[] }>();
    for (const item of items) {
      const stand = standForIssue(item.issue);
      const key = stand?.id ?? item.issue;
      const cur = map.get(key);
      if (cur) cur.items.push(item);
      else map.set(key, { stand, issue: item.issue, items: [item] });
    }
    return [...map.values()];
  }, [items, standForIssue]);

  const relatedStand = useMemo(() => {
    const item = items[active];
    if (!item) return null;
    return standForIssue(item.issue);
  }, [items, active, standForIssue]);

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

  const openAt = (idx: number) => {
    setActive(idx);
    setBrowsing(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 bg-navyDeep text-white flex items-center justify-center">
        {t('misc.loading')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center space-y-4">
        <h1 className="font-display font-bold text-2xl text-navy">{t('evidence.title')}</h1>
        <p className="text-sub text-sm">{t('evidence.empty')}</p>
        <Link to="/add" className="btn-primary inline-flex">
          + {t('nav.add')}
        </Link>
      </div>
    );
  }

  if (browsing) {
    return (
      <div className="min-h-screen bg-bg pb-24">
        <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
          <Link to="/feed" className="text-sm font-semibold text-navy">
            ← {t('misc.back')}
          </Link>
          <h1 className="font-display font-bold text-lg text-navy flex-1">{t('evidence.title')}</h1>
        </header>
        <div className="mx-auto max-w-2xl px-4 pt-6 space-y-8">
          <p className="text-sm text-sub">{t('evidence.browseSub')}</p>
          {groups.map((g) => {
            const title = g.stand
              ? lang === 'hi' && g.stand.title_hi
                ? g.stand.title_hi
                : g.stand.title
              : issueLabel(g.issue, lang);
            const standing = g.stand ? standCounts[g.stand.id]?.total ?? 0 : 0;
            return (
              <section key={g.stand?.id ?? g.issue} className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-xl text-navy">{title}</h2>
                    <p className="text-xs text-sub mt-0.5">
                      {fmt(g.items.length)} {t('evidence.clipCount')}
                      {g.stand ? ` · ${fmt(standing)} ${t('counts.standing')}` : ''}
                    </p>
                  </div>
                  {g.stand && (
                    <Link to={`/stand/${g.stand.id}`} className="text-sm text-navy underline underline-offset-4 shrink-0">
                      {t('stand.standWith')}
                    </Link>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                  {g.items.map((item) => {
                    const idx = items.findIndex((x) => x.id === item.id);
                    const img = evidencePoster(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openAt(idx)}
                        className="snap-start shrink-0 w-36 rounded-2xl overflow-hidden border border-line bg-faint text-left"
                      >
                        <div className="relative aspect-[9/16] bg-navyDeep">
                          {img ? (
                            <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-white/80">
                              <span className="text-xs font-mono">{PLATFORM_LABEL[item.platform]}</span>
                              <span className="text-[11px] line-clamp-3">{item.title || issueLabel(item.issue, lang)}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black text-white">
      <header className="absolute top-0 inset-x-0 z-50 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <button
          type="button"
          className="text-sm font-semibold pointer-events-auto"
          onClick={() => setBrowsing(true)}
        >
          ← {t('misc.back')}
        </button>
        <p className="text-xs font-mono truncate pointer-events-none">
          {relatedStand
            ? lang === 'hi' && relatedStand.title_hi
              ? relatedStand.title_hi
              : relatedStand.title
            : issue
              ? issueLabel(issue, lang)
              : t('evidence.title')}
        </p>
        <button type="button" className="text-sm min-h-11 px-2 pointer-events-auto" onClick={() => setMuted((m) => !m)}>
          {muted ? t('evidence.unmute') : t('evidence.mute')}
        </button>
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
          const yid = item.platform === 'youtube' ? ytId(item.url) : null;
          const iid = item.platform === 'instagram' ? igId(item.url) : null;
          const img = evidencePoster(item);
          const embedReady = !!ready[item.id];

          return (
            <section
              key={item.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-idx={idx}
              className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-black"
            >
              {/* Poster always under; never black while loading */}
              {img ? (
                <img
                  src={img}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
                    isActive && embedReady && (yid || iid) ? 'opacity-0' : 'opacity-90'
                  }`}
                  loading={near ? 'eager' : 'lazy'}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-navyDeep to-black px-6 text-center">
                  <p className="text-sm font-mono text-white/70">{PLATFORM_LABEL[item.platform]}</p>
                  <p className="text-base font-semibold line-clamp-4">
                    {item.title || issueLabel(item.issue, lang)}
                  </p>
                  {item.state && <p className="text-xs text-white/50">{stateName(item.state, lang)}</p>}
                </div>
              )}

              {/* pointer-events-none so vertical swipe reaches the scroller */}
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

              {isActive && iid && (
                <iframe
                  className={`absolute inset-0 w-full h-full bg-transparent pointer-events-none transition-opacity duration-200 ${
                    embedReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  src={`https://www.instagram.com/reel/${iid}/embed/captioned/`}
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

              <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-3 pointer-events-auto">
                <p className="text-[11px] font-mono uppercase tracking-wide text-saffron">
                  {t('feed.unverified')} · {PLATFORM_LABEL[item.platform]}
                  {item.state ? ` · ${stateName(item.state, lang)}` : ` · ${t('add.allIndia')}`}
                </p>
                <p className="text-sm font-semibold line-clamp-2">
                  {item.title || issueLabel(item.issue, lang)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void react(item, 'up')}
                    className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold border ${
                      my === 'up' ? 'bg-white text-navy border-white' : 'border-white/40'
                    }`}
                  >
                    {t('evidence.useful')} · {c.ups}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void react(item, 'down')}
                    className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold border ${
                      my === 'down' ? 'bg-white text-navy border-white' : 'border-white/40'
                    }`}
                  >
                    {t('evidence.notUseful')} · {c.downs}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-h-11 rounded-full px-4 py-2 text-sm border border-white/30 text-white/80 inline-flex items-center"
                  >
                    {t('evidence.openOriginal')}
                  </a>
                  <button
                    type="button"
                    onClick={() => void report(item)}
                    className="min-h-11 rounded-full px-4 py-2 text-sm border border-white/30 text-white/80"
                  >
                    {t('feed.report')}
                  </button>
                </div>
                {relatedStand && (
                  <Link
                    to={`/stand/${relatedStand.id}`}
                    className="flex items-center justify-center min-h-12 w-full rounded-2xl px-4 py-3 text-base font-bold bg-saffron text-navy shadow-lift"
                  >
                    {t('evidence.nowStand')}:{' '}
                    {lang === 'hi' && relatedStand.title_hi ? relatedStand.title_hi : relatedStand.title}
                  </Link>
                )}
                <p className="text-center text-[10px] text-white/40">{t('evidence.swipeHint')}</p>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
