/**
 * feed-submit — a citizen submits a link.
 *
 * TEMPORARY publish policy (human-approved): items land as `approved`
 * immediately so evidence is visible without a moderator round-trip.
 * Safety that remains: share-tag scrub, sealed ledger, keyword `flagged`,
 * report → `re_review` hide, unverified label, never re-host.
 * Flip the insert status back to `pending` to restore human-before-public.
 */
import { adminClient, json, preflight } from '../_shared/common.ts';
import { parseSocialUrl } from '../_shared/feedUrl.ts';

const RATE_LIMIT_PER_DAY = 10;

/** Words that merely FLAG an item for priority human review. */
const PRESCREEN = [
  'address', 'phone number', 'aadhaar', 'aadhar', 'pan card', 'home of',
  'kill', 'shoot', 'blood', 'gore', 'corpse', 'dead body',
  'nude', 'nsfw', 'xxx', 'porn',
  'traitor', 'anti-national', 'jihad', 'terrorist',
];

const ISSUES = [
  'education', 'employment', 'transparency', 'democracy',
  'health', 'environment', 'infrastructure', 'safety',
];

const STATE_CODES = new Set([
  'JK','HP','PB','UK','HR','DL','RJ','UP','BR','SK','AR','GJ','MP','CG','JH',
  'WB','AS','ML','NL','MN','TR','MZ','MH','GA','TS','OD','KA','AP','TN','KL',
]);

/**
 * Public metadata only — no HTML scraping, never re-host bytes.
 * Instagram: token-free. Prefer Meta's tokenless oEmbed (June 2026+) plus
 * Instagram's public `/p/{id}/media/?size=l` poster (stable redirect to JPEG).
 * Optional INSTAGRAM_OEMBED_TOKEN still works if set, but is not required.
 */
async function fetchMeta(
  platform: string,
  canon: string,
  id: string
): Promise<{ title?: string; author_name?: string; thumbnail_url?: string }> {
  try {
    if (platform === 'youtube') {
      const r = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canon)}`
      );
      if (!r.ok) return {};
      const d = await r.json();
      return { title: d.title, author_name: d.author_name, thumbnail_url: d.thumbnail_url };
    }
    if (platform === 'x') {
      const r = await fetch(
        `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(canon)}`
      );
      if (!r.ok) return {};
      const d = await r.json();
      // Strip markup: we store plain text only.
      const text = String(d.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return { title: text.slice(0, 280), author_name: d.author_name };
    }
    if (platform === 'instagram') {
      // Stable public poster — works for reel/post/tv shortcodes via /p/ path.
      const publicPoster = `https://www.instagram.com/p/${id}/media/?size=l`;
      let title: string | undefined;
      let author_name: string | undefined;
      let thumbnail_url: string | undefined = publicPoster;

      // Confirm the public media endpoint returns an image (follow redirects).
      try {
        const img = await fetch(publicPoster, {
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            Accept: 'image/*,*/*',
          },
        });
        const ct = img.headers.get('content-type') ?? '';
        if (!img.ok || !ct.startsWith('image/')) {
          thumbnail_url = undefined;
        }
      } catch {
        thumbnail_url = undefined;
      }

      // Tokenless Instagram oEmbed (no app review). Token optional for higher limits.
      const token = Deno.env.get('INSTAGRAM_OEMBED_TOKEN');
      const oembedUrl = token
        ? `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(canon)}&access_token=${token}`
        : `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(canon)}`;
      try {
        const r = await fetch(oembedUrl);
        if (r.ok) {
          const d = await r.json();
          if (d.title) title = String(d.title).slice(0, 280);
          if (d.author_name) author_name = String(d.author_name);
          // thumbnail_url was removed from oEmbed (Nov 2025); keep public poster.
          if (d.thumbnail_url) thumbnail_url = String(d.thumbnail_url);
        }
      } catch {
        /* oEmbed optional */
      }

      // Readable fallback title so cards never look empty.
      if (!title) title = `Instagram · ${id}`;
      return { title, author_name, thumbnail_url };
    }
  } catch {
    // Metadata is a nicety; submission still proceeds.
  }
  return {};
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = adminClient();

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !userData?.user) return json({ error: 'sign in to submit' }, 401);
  const userId = userData.user.id;

  let body: { url?: string; issue?: string; state?: string | null; scope?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const parsed = parseSocialUrl(body.url ?? '');
  if (!parsed) return json({ error: 'unsupported link' }, 400);
  if (!ISSUES.includes(body.issue ?? '')) return json({ error: 'pick an issue' }, 400);

  // Geography required: a valid state code OR explicit national (All India).
  const wantsNational =
    body.scope === 'national' || body.state === '' || body.state === 'IN' || body.state === '__national__';
  const stateCode = body.state && STATE_CODES.has(body.state) ? body.state : null;
  if (!wantsNational && !stateCode) {
    return json({ error: 'pick a state or All India' }, 400);
  }
  const scope = wantsNational && !stateCode ? 'national' : 'state';
  const state = scope === 'national' ? null : stateCode;

  // Rate limit (rolling 24h).
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from('submission_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('submitted_at', since);
  if ((count ?? 0) >= RATE_LIMIT_PER_DAY) {
    return json({ error: 'daily limit reached', limit: RATE_LIMIT_PER_DAY }, 429);
  }

  // Global dedup on the canonical URL.
  const { data: existing } = await admin
    .from('feed_items')
    .select('id, status')
    .eq('url_canon', parsed.canon)
    .maybeSingle();
  if (existing) {
    await admin.from('submission_ledger').insert({
      user_id: userId,
      feed_item_id: existing.id,
      url_canon: parsed.canon,
    });
    return json({ ok: true, duplicate: true, status: existing.status });
  }

  const meta = await fetchMeta(parsed.platform, parsed.canon, parsed.id);
  const haystack = `${meta.title ?? ''} ${meta.author_name ?? ''}`.toLowerCase();
  const flagged = PRESCREEN.some((w) => haystack.includes(w));

  const { data: item, error: insErr } = await admin
    .from('feed_items')
    .insert({
      url: parsed.canon,
      url_canon: parsed.canon,
      platform: parsed.platform,
      title: meta.title ?? null,
      author_name: meta.author_name ?? null,
      thumbnail_url: meta.thumbnail_url ?? null,
      issue: body.issue,
      state,
      scope,
      // TEMPORARY (human-approved): auto-publish so evidence lands immediately.
      // Report → re_review still hides; flagged still prioritises /admin.
      // Flip back to 'pending' to restore human-before-public.
      status: 'approved',
      approved_at: new Date().toISOString(),
      flagged,
    })
    .select('id')
    .single();
  if (insErr) return json({ error: 'could not submit' }, 500);

  await admin.from('submission_ledger').insert({
    user_id: userId,
    feed_item_id: item.id,
    url_canon: parsed.canon,
  });

  return json({ ok: true, status: 'approved' });
});
