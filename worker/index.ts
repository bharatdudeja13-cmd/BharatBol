/**
 * BharatBol Worker — per-stand Open Graph tags.
 *
 * Only `/stand/*` reaches this Worker (see `run_worker_first` in
 * wrangler.jsonc); everything else is served straight from the CDN. For a
 * stand URL we fetch the SPA shell from the ASSETS binding and rewrite its
 * OG meta so links unfurl with the issue title and its pre-rendered image
 * on WhatsApp/X. Any failure falls through to the untouched shell — a
 * broken preview must never break the page.
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const shell = () => env.ASSETS.fetch(new Request(new URL('/', url), request));

    const id = url.pathname.match(/^\/stand\/([^/]+)\/?$/)?.[1];
    if (!id) return shell();

    try {
      const title = await standTitle(env, id);
      if (!title) return shell();

      const image = `${url.origin}/og/${tagFor(title) ?? 'default'}.png`;
      const html = (await (await shell()).text())
        .replace(
          /<meta property="og:title" content="[^"]*"/,
          `<meta property="og:title" content="${esc(title)} — BharatBol"`
        )
        .replace(
          /<meta property="og:description" content="[^"]*"/,
          '<meta property="og:description" content="Bharat, bol. Add your voice — counted, verifiable, anonymous."'
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
