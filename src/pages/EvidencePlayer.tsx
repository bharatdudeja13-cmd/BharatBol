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
import type { FeedItem } from '../lib/types';
import { isLive, supabase } from '../lib/supabase';

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

function poster(item: FeedItem): string | null {
  if (item.thumbnail_url) return item.thumbnail_url;
  const y = item.platform === 'youtube' ? ytId(item.url) : null;
  return y ? `https://i.ytimg.com/vi/${y}/hqdefault.jpg` : null;
}

/** Full-viewport shorts player. Poster stays until embed loads; one active iframe. */
export default function EvidencePlayer() {
  const [params] = useSearchParams();
  const issue = isIssueSlug(params.get('issue') ?? '') ? params.get('issue') : null;
  const state = params.get('state');
  const startId = params.get('id');

  const { t, lang } = useI18n();
  const { session, signIn } = useAuth();
  const { stands } = useStands();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({});
  const [mine, setMine] = useState<Record<string, 'up' | 'down'>>({});
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Embed ready per item id — poster stays until true. */
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setReady({});
      const list = await loadEvidence({ issue, state, limit: 40 });
      if (cancelled) return;
      setItems(list);
      setCounts(await loadReactionCounts(list.map((i) => i.id)));
      const idx = startId ? Math.max(0, list.findIndex((i) => i.id === startId)) : 0;
      setActive(idx < 0 ? 0 : idx);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [issue, state, startId]);

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
    slideRefs.current[active]?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
        if (best && best.ratio >= 0.6) setActive(best.idx);
      },
      { root, threshold: [0.55, 0.7, 0.85] }
    );
    for (const el of slideRefs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [items.length]);

  // Mute/unmute YouTube without remounting (avoids black flash).
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
    return stands.find((s) => s.category === item.issue) ?? null;
  }, [stands, items, active]);

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

  return (
    <div className="fixed inset-0 z-40 bg-black text-white">
      <header className="absolute top-0 inset-x-0 z-50 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <Link to={issue ? `/feed?issue=${issue}` : state ? '/' : '/feed'} className="text-sm font-semibold">
          ← {t('misc.back')}
        </Link>
        <p className="text-xs font-mono truncate">
          {issue ? issueLabel(issue, lang) : t('evidence.title')}
          {state ? ` · ${stateName(state, lang)}` : ''}
        </p>
        <button type="button" className="text-sm min-h-11 px-2" onClick={() => setMuted((m) => !m)}>
          {muted ? t('evidence.unmute') : t('evidence.mute')}
        </button>
      </header>

      <div
        ref={scrollerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory overscroll-y-contain"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {items.map((item, idx) => {
          const isActive = idx === active;
          const near = Math.abs(idx - active) <= 1;
          const c = counts[item.id] ?? { ups: 0, downs: 0 };
          const my = mine[item.id];
          const yid = item.platform === 'youtube' ? ytId(item.url) : null;
          const iid = item.platform === 'instagram' ? igId(item.url) : null;
          const img = poster(item);
          const embedReady = !!ready[item.id];
          const showPoster = !isActive || !embedReady || !(yid || iid);

          return (
            <section
              key={item.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-idx={idx}
              className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-black"
            >
              {showPoster &&
                (img ? (
                  <img
                    src={img}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                    loading={near ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navyDeep px-6 text-center">
                    <p className="text-sm font-mono text-white/70">{PLATFORM_LABEL[item.platform]}</p>
                    <p className="text-base font-semibold line-clamp-4">{item.title ?? item.url}</p>
                  </div>
                ))}

              {isActive && yid && (
                <iframe
                  ref={ytIframeRef}
                  className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
                    embedReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  src={`https://www.youtube-nocookie.com/embed/${yid}?autoplay=1&rel=0&playsinline=1&modestbranding=1&mute=1&enablejsapi=1`}
                  title={item.title ?? 'YouTube'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    setReady((r) => ({ ...r, [item.id]: true }));
                    if (!muted && ytIframeRef.current?.contentWindow) {
                      try {
                        ytIframeRef.current.contentWindow.postMessage(
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

              {isActive && iid && (
                <iframe
                  className={`absolute inset-0 w-full h-full bg-black transition-opacity duration-300 ${
                    embedReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  src={`https://www.instagram.com/reel/${iid}/embed/captioned/`}
                  title={item.title ?? 'Instagram'}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  loading="eager"
                  onLoad={() => setReady((r) => ({ ...r, [item.id]: true }))}
                />
              )}

              {isActive && item.platform === 'x' && (
                <div className="relative z-10 max-w-md mx-auto px-6 text-center space-y-4">
                  <p className="text-sm font-mono text-white/70">{PLATFORM_LABEL.x}</p>
                  <p className="text-lg leading-snug">{item.title}</p>
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

              <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/85 via-black/45 to-transparent space-y-3">
                <p className="text-[11px] font-mono uppercase tracking-wide text-saffron">
                  {t('feed.unverified')} · {PLATFORM_LABEL[item.platform]}
                  {(item.scope ?? (item.state ? 'state' : 'national')) === 'national'
                    ? ` · ${t('add.allIndia')}`
                    : item.state
                      ? ` · ${stateName(item.state, lang)}`
                      : ''}
                </p>
                <p className="text-sm font-semibold line-clamp-2">{item.title ?? item.url}</p>
                <p className="text-xs text-white/70">{issueLabel(item.issue, lang)}</p>
                <p className="text-[11px] text-white/60">{t('evidence.reactHonest')}</p>

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
                    {t('evidence.nowStand')} — {lang === 'hi' && relatedStand.title_hi ? relatedStand.title_hi : relatedStand.title}
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
