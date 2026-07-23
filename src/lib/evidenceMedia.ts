import type { FeedItem } from './types';
import { parseSocialUrl } from './feedUrl';

/** Extract a YouTube video id from any supported watch / shorts / youtu.be URL. */
export function youtubeIdFromUrl(url: string): string | null {
  const parsed = parseSocialUrl(url);
  if (parsed?.platform === 'youtube') return parsed.id;
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([^/]+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Reel embed src for a YouTube video id.
 *
 * Every param here is load-bearing for tap-to-play, so it lives in one
 * tested place (tests/reel-playback.test.ts) rather than inline in the
 * player JSX where a future edit could silently drop one:
 *   - mute=1 + playsinline=1  → muted inline autoplay is allowed by mobile
 *     browser policy; without both, tapping a reel shows a frozen poster.
 *   - autoplay=1              → start on mount of the active slide.
 *   - enablejsapi=1           → lets the unmute control postMessage the player.
 * Instagram is deliberately NOT playable inline (poster + open original).
 */
export function youtubeReelEmbedSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
    controls: '0',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/** Instagram shortcode from a reel / post / tv URL. */
export function instagramShortcode(url: string): string | null {
  const parsed = parseSocialUrl(url);
  if (parsed?.platform === 'instagram') return parsed.id;
  const m = url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

/** Same-origin Worker proxy - avoids Instagram hotlink blocks in the browser. */
export function instagramProxyPoster(shortcode: string): string {
  return `/api/ig-poster/${encodeURIComponent(shortcode)}`;
}

/**
 * Direct Instagram public media URL (no token). Prefer the Worker proxy in
 * the browser; keep this as a fallback candidate.
 */
export function instagramDirectPoster(shortcode: string): string {
  return `https://www.instagram.com/p/${shortcode}/media/?size=l`;
}

/**
 * Token-free Instagram poster URL for simple callers.
 * Prefers same-origin `/api/ig-poster/:id` (Cloudflare Worker).
 */
export function instagramPublicPoster(url: string): string | null {
  const id = instagramShortcode(url);
  return id ? instagramProxyPoster(id) : null;
}

/**
 * Ordered poster candidates. EvidenceThumb walks these on error so a
 * hotlink failure still shows a real image or a branded placeholder.
 */
export function evidencePosterCandidates(item: FeedItem): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const s = u?.trim();
    if (s && !out.includes(s)) out.push(s);
  };

  const raw = item.thumbnail_url?.trim();
  const shortcode = item.platform === 'instagram' ? instagramShortcode(item.url) : null;
  const proxy = shortcode ? instagramProxyPoster(shortcode) : null;
  const direct = shortcode ? instagramDirectPoster(shortcode) : null;

  if (item.platform === 'instagram') {
    // Proxy first (works on Workers + vite dev middleware).
    push(proxy);
    if (raw && !raw.includes('instagram.com') && !raw.includes('/api/ig-poster/')) {
      push(raw);
    } else if (raw) {
      push(raw);
    }
    push(direct);
    // Medium size sometimes succeeds when large is blocked.
    if (shortcode) push(`https://www.instagram.com/p/${shortcode}/media/?size=m`);
    return out;
  }

  if (item.platform === 'youtube') {
    const y = youtubeIdFromUrl(item.url);
    // Prefer YouTube CDN over a stale/broken stored thumbnail.
    push(y ? `https://i.ytimg.com/vi/${y}/hqdefault.jpg` : null);
    push(y ? `https://i.ytimg.com/vi/${y}/mqdefault.jpg` : null);
    push(raw);
    return out;
  }

  push(raw);
  return out;
}

/** Best single poster URL (first candidate). Prefer evidencePosterCandidates. */
export function evidencePoster(item: FeedItem): string | null {
  return evidencePosterCandidates(item)[0] ?? null;
}
