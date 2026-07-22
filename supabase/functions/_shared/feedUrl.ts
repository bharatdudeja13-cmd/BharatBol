// Authoritative copy of src/lib/feedUrl.ts for the Deno runtime.
// MUST stay identical — tests/feed-url.test.ts asserts the two files match.
export type Platform = 'youtube' | 'x' | 'instagram';

export type ParsedUrl = {
  platform: Platform;
  canon: string;
  id: string;
};

const TRACKING = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'si', 'feature', 'igsh', 'igshid', 'ref_src', 'ref_url', 's', 't', 'fbclid', 'gclid',
];

export function parseSocialUrl(raw: string): ParsedUrl | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  for (const p of TRACKING) u.searchParams.delete(p);

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? { platform: 'youtube', canon: `https://www.youtube.com/watch?v=${id}`, id } : null;
  }
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      return id ? { platform: 'youtube', canon: `https://www.youtube.com/watch?v=${id}`, id } : null;
    }
    const short = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
    if (short) {
      return { platform: 'youtube', canon: `https://www.youtube.com/watch?v=${short[1]}`, id: short[1] };
    }
    return null;
  }

  if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
    const m = u.pathname.match(/^\/([A-Za-z0-9_]{1,20})\/status\/(\d+)/);
    if (!m) return null;
    return {
      platform: 'x',
      canon: `https://x.com/${m[1].toLowerCase()}/status/${m[2]}`,
      id: m[2],
    };
  }

  if (host === 'instagram.com' || host === 'instagr.am') {
    const m = u.pathname.match(/^\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const kind = u.pathname.startsWith('/p/') ? 'p' : u.pathname.startsWith('/tv/') ? 'tv' : 'reel';
    return {
      platform: 'instagram',
      canon: `https://www.instagram.com/${kind}/${m[1]}/`,
      id: m[1],
    };
  }

  return null;
}
