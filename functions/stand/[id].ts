/**
 * Cloudflare Pages Function: per-stand Open Graph tags for /stand/:id,
 * so links unfurl with the issue and its pre-rendered image on
 * WhatsApp/X. Falls back to the default tags on any failure — the SPA
 * itself is untouched. No count in the OG data: static counts go stale,
 * and stale counts would violate the honest-counts guardrail.
 *
 * Needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY as Pages env vars
 * (already set for the build). Keep the CURATED list in sync with
 * src/lib/campaign.ts.
 */
interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const CURATED: [RegExp, string][] = [
  [/NEET|CBSE/i, 'ExamAudit'],
  [/audit reports/i, 'OpenAudits'],
  [/teaching posts/i, 'FillTeacherPosts'],
  [/integrity of every vote/i, 'EveryVoteSafe'],
  [/unemployment/i, 'YouthJobs'],
];

function tagFor(title: string): string | null {
  for (const [re, tag] of CURATED) if (re.test(title)) return tag;
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const res = await context.env.ASSETS.fetch(new Request(new URL('/', context.request.url)));
  let html = await res.text();

  try {
    const id = String(context.params.id ?? '');
    const base = context.env.VITE_SUPABASE_URL;
    const anon = context.env.VITE_SUPABASE_ANON_KEY;
    if (base && anon && /^[0-9a-f-]{36}$/i.test(id)) {
      const r = await fetch(
        `${base}/rest/v1/stands?id=eq.${id}&status=eq.live&select=title`,
        { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
      );
      const rows = (await r.json()) as { title: string }[];
      const title = rows?.[0]?.title;
      if (title) {
        const origin = new URL(context.request.url).origin;
        const tag = tagFor(title);
        const image = `${origin}/og/${tag ?? 'default'}.png`;
        html = html
          .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(title)} — BharatBol"`)
          .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="Bharat, bol. Add your voice — counted, verifiable, anonymous."`)
          .replace('</head>', `<meta property="og:image" content="${image}" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="${image}" /></head>`);
      }
    }
  } catch {
    // Any failure: serve the untouched SPA shell.
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
};
