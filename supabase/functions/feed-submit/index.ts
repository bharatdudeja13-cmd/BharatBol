/**
 * feed-submit — a citizen submits a link. Nothing here can publish.
 *
 * Pre-checks, in order: authenticated caller → supported/canonical URL →
 * per-account rate limit → global dedup → official oEmbed metadata →
 * conservative keyword pre-screen (sets `flagged` to PRIORITISE human
 * review; it never approves and never rejects) → insert as 'pending'.
 *
 * Privacy: the account id is recorded ONLY in the sealed
 * submission_ledger (anti-abuse, dedup, takedown). feed_items has no
 * submitter column, so the public feed cannot expose or infer who
 * submitted anything.
 */
import { adminClient, json, preflight } from '../_shared/common.ts';
import { parseSocialUrl } from '../_shared/feedUrl.ts';

const RATE_LIMIT_PER_DAY = 5;

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

/** Official oEmbed only. No scraping, ever; failure is non-fatal. */
async function fetchMeta(platform: string, canon: string) {
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
    // Instagram oEmbed needs a Facebook app token. Without one we keep the
    // titled link-card and do NOT scrape. See docs/content-feed-design.md.
    const token = Deno.env.get('INSTAGRAM_OEMBED_TOKEN');
    if (platform === 'instagram' && token) {
      const r = await fetch(
        `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(canon)}&access_token=${token}`
      );
      if (!r.ok) return {};
      const d = await r.json();
      return { title: d.title, author_name: d.author_name, thumbnail_url: d.thumbnail_url };
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

  let body: { url?: string; issue?: string; state?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const parsed = parseSocialUrl(body.url ?? '');
  if (!parsed) return json({ error: 'unsupported link' }, 400);
  if (!ISSUES.includes(body.issue ?? '')) return json({ error: 'pick an issue' }, 400);
  const state = body.state && STATE_CODES.has(body.state) ? body.state : null;

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

  const meta = await fetchMeta(parsed.platform, parsed.canon);
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
      status: 'pending', // the ONLY status this function can write
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

  return json({ ok: true, status: 'pending' });
});
