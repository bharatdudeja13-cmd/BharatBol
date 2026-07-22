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

/** Instagram shortcode from a reel / post / tv URL. */
export function instagramShortcode(url: string): string | null {
  const parsed = parseSocialUrl(url);
  if (parsed?.platform === 'instagram') return parsed.id;
  const m = url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

/**
 * Token-free Instagram poster. Instagram's public `/p/{id}/media/?size=l`
 * redirects to a JPEG — no Facebook app token, no scraping.
 * Prefer `/p/` path even for reels/tv; `/reel/.../media` often 404s.
 */
export function instagramPublicPoster(url: string): string | null {
  const id = instagramShortcode(url);
  return id ? `https://www.instagram.com/p/${id}/media/?size=l` : null;
}

/**
 * Best-effort poster URL for strip / player / feed.
 * Instagram never needs INSTAGRAM_OEMBED_TOKEN — public media endpoint first.
 * Callers must still fall back to a branded placeholder when the image errors.
 */
export function evidencePoster(item: FeedItem): string | null {
  const raw = item.thumbnail_url?.trim();
  if (raw) return raw;
  if (item.platform === 'youtube') {
    const y = youtubeIdFromUrl(item.url);
    return y ? `https://i.ytimg.com/vi/${y}/hqdefault.jpg` : null;
  }
  if (item.platform === 'instagram') {
    return instagramPublicPoster(item.url);
  }
  return null;
}
