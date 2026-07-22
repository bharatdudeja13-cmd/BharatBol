/**
 * feed-moderate — the ONLY path to publication. Admin-gated.
 *
 * Actions: list (pending/flagged/re_review queue), approve (confirming or
 * correcting issue + state), reject (with a reason code), needs_info.
 *
 * Callers must be in the sealed `admins` table. The queue returned here
 * contains no submitter identity: moderators judge the content, not the
 * person — and the sealed ledger is never joined into this response.
 */
import { adminClient, json, preflight } from '../_shared/common.ts';

const REASONS = [
  'doxxing', 'violence', 'targeting', 'sexual', 'minor',
  'misinfo', 'offtopic', 'duplicate', 'other',
];

const ISSUES = [
  'education', 'employment', 'transparency', 'democracy',
  'health', 'environment', 'infrastructure', 'safety',
];

const STATE_CODES = new Set([
  'JK','HP','PB','UK','HR','DL','RJ','UP','BR','SK','AR','GJ','MP','CG','JH',
  'WB','AS','ML','NL','MN','TR','MZ','MH','GA','TS','OD','KA','AP','TN','KL',
]);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = adminClient();

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !userData?.user) return json({ error: 'not signed in' }, 401);

  const { data: isAdmin } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!isAdmin) return json({ error: 'not a moderator' }, 403);

  let body: {
    action?: string;
    id?: string;
    issue?: string;
    state?: string | null;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  // ---- Queue ----
  if (body.action === 'list') {
    const { data, error } = await admin
      .from('feed_items')
      .select('id,url,platform,title,author_name,thumbnail_url,issue,state,status,flagged,reports,submitted_on')
      .in('status', ['pending', 'needs_info', 're_review'])
      // Flagged and reported items first — priority review.
      .order('flagged', { ascending: false })
      .order('reports', { ascending: false })
      .order('submitted_on', { ascending: true })
      .limit(200);
    if (error) return json({ error: 'queue unavailable' }, 500);
    return json({ items: data ?? [] });
  }

  if (!body.id) return json({ error: 'missing id' }, 400);

  // ---- Approve (may correct the issue/state the submitter chose) ----
  if (body.action === 'approve') {
    const patch: Record<string, unknown> = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      reject_reason: null,
    };
    if (body.issue) {
      if (!ISSUES.includes(body.issue)) return json({ error: 'bad issue' }, 400);
      patch.issue = body.issue;
    }
    if (body.state !== undefined) {
      patch.state = body.state && STATE_CODES.has(body.state) ? body.state : null;
    }
    const { error } = await admin.from('feed_items').update(patch).eq('id', body.id);
    if (error) return json({ error: 'update failed' }, 500);
    return json({ ok: true, status: 'approved' });
  }

  // ---- Reject (reason code required) ----
  if (body.action === 'reject') {
    if (!REASONS.includes(body.reason ?? '')) return json({ error: 'reason required' }, 400);
    const { error } = await admin
      .from('feed_items')
      .update({ status: 'rejected', reject_reason: body.reason, approved_at: null })
      .eq('id', body.id);
    if (error) return json({ error: 'update failed' }, 500);
    return json({ ok: true, status: 'rejected' });
  }

  // ---- Needs info ----
  if (body.action === 'needs_info') {
    const { error } = await admin
      .from('feed_items')
      .update({ status: 'needs_info', approved_at: null })
      .eq('id', body.id);
    if (error) return json({ error: 'update failed' }, 500);
    return json({ ok: true, status: 'needs_info' });
  }

  return json({ error: 'unknown action' }, 400);
});
