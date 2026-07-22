/**
 * BharatBol Worker — per-stand Open Graph tags + Instagram poster proxy.
 *
 * Routes that hit this Worker (see `run_worker_first` in wrangler.jsonc):
 *   /stand/*           → OG rewrite for share unfurls
 *   /api/ig-poster/*   → token-free Instagram JPEG proxy (browser hotlink safe)
 *
 * Everything else is served straight from the CDN. Failures fall through
 * safely — a broken preview must never break the page.
 *
 * No count in the OG data, on purpose: a static number goes stale, and a
 * stale count on a shared link would break the honest-counts guardrail.
 * The live number belongs to the page itself.
 */
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

/** Keep in sync with src/lib/campaign.ts and scripts/og-stands.json. */
const CURATED: [RegExp, string][] = [
  [/NEET|CBSE/i, 'ExamAudit'],
  [/audit reports/i, 'OpenAudits'],
  [/teaching posts/i, 'FillTeacherPosts'],
  [/integrity of every vote/i, 'EveryVoteSafe'],
  [/unemployment/i, 'YouthJobs'],
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IG_SHORTCODE_RE = /^[A-Za-z0-9_-]{5,64}$/;

function tagFor(title: string): string | null {
  for (const [re, tag] of CURATED) if (re.test(title)) return tag;
  return null;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function standTitle(env: Env, id: string): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !UUID_RE.test(id)) return null;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/stands?id=eq.${id}&status=eq.live&select=title`,
    {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { title?: string }[];
  return rows?.[0]?.title ?? null;
}

/**
 * Token-free Instagram poster. Server-side fetch follows
 * /p/{shortcode}/media/?size=l → CDN JPEG. No Facebook app token.
 */
async function instagramPoster(shortcode: string): Promise<Response> {
  if (!IG_SHORTCODE_RE.test(shortcode)) {
    return new Response('Not found', { status: 404 });
  }
  const src = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  try {
    const res = await fetch(src, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.startsWith('image/')) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const shell = () => env.ASSETS.fetch(new Request(new URL('/', url), request));

    const ig = url.pathname.match(/^\/api\/ig-poster\/([^/]+)\/?$/);
    if (ig) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      return instagramPoster(decodeURIComponent(ig[1]));
    }

    const id = url.pathname.match(/^\/stand\/([^/]+)\/?$/)?.[1];
    if (!id) return shell();

    try {
      const title = await standTitle(env, id);
      if (!title) return shell();

      const image = `${url.origin}/og/${tagFor(title) ?? 'default'}.png`;
      const html = (await (await shell()).text())
        .replace(
          /<meta property="og:title" content="[^"]*"/,
          `<meta property="og:title" content="${esc(title)} - BharatBol"`
        )
        .replace(
          /<meta property="og:description" content="[^"]*"/,
          '<meta property="og:description" content="Bharat, bol. Add your voice - counted, verifiable, anonymous."'
        )
        .replace(
          '</head>',
          `<meta property="og:image" content="${image}" />` +
            `<meta property="og:url" content="${esc(url.toString())}" />` +
            '<meta name="twitter:card" content="summary_large_image" />' +
            `<meta name="twitter:image" content="${image}" /></head>`
        );

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch {
      return shell();
    }
  },
};
