/**
 * feed-moderate — the ONLY path to publication. Admin-gated.
 *
 * Actions: list (pending / needs_info / re_review queue), approve (confirming or
 * correcting issue + state), reject (with a reason code), needs_info.
 *
 * Queue order (intentional): re_review first (already hidden from the public
 * feed — fast re-review), then flagged pendings, then report count, then age.
 *
 * Callers must be in the sealed `admins` table. The queue returned here
 * contains no submitter identity: moderators judge the content, not the
 * person — and the sealed ledger is never joined into this response.
 */
import { adminClient, json, preflight } from '../_shared/common.ts';

const REASONS = [
  'doxxing', 'violence', 'targeting', 'sexual', 'minor', 'personal',
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
    relevant?: boolean;
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
      .limit(200);
    if (error) return json({ error: 'queue unavailable' }, 500);

    // Priority: re_review (hidden from public — fast path) → flagged →
    // report count → oldest. In-memory so status rank is explicit; a later
    // threshold rule still lands items here via status='re_review'.
    const rank: Record<string, number> = { re_review: 0, pending: 1, needs_info: 2 };
    const items = [...(data ?? [])].sort((a, b) => {
      const ra = rank[a.status as string] ?? 9;
      const rb = rank[b.status as string] ?? 9;
      if (ra !== rb) return ra - rb;
      if (!!a.flagged !== !!b.flagged) return a.flagged ? -1 : 1;
      const rep = (b.reports as number ?? 0) - (a.reports as number ?? 0);
      if (rep !== 0) return rep;
      return String(a.submitted_on ?? '').localeCompare(String(b.submitted_on ?? ''));
    });
    return json({ items });
  }

  // ---- Already-approved items, so a moderator can remove ones that fail
  //      the relevance bar after the fact. ----
  if (body.action === 'list_approved') {
    const { data, error } = await admin
      .from('feed_items')
      .select('id,url,platform,title,author_name,thumbnail_url,issue,state,status,flagged,reports,submitted_on')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(100);
    if (error) return json({ error: 'list failed' }, 500);
    return json({ items: data ?? [] });
  }

  if (!body.id) return json({ error: 'missing id' }, 400);

  // ---- Remove an already-approved item (reason required) ----
  if (body.action === 'remove') {
    if (!REASONS.includes(body.reason ?? '')) return json({ error: 'reason required' }, 400);
    const { error } = await admin
      .from('feed_items')
      .update({ status: 'rejected', reject_reason: body.reason, approved_at: null })
      .eq('id', body.id);
    if (error) return json({ error: 'remove failed' }, 500);
    return json({ ok: true, status: 'rejected' });
  }

  // ---- Approve (may correct the issue/state the submitter chose) ----
  if (body.action === 'approve') {
    // Relevance is a required approval criterion: the reviewer must affirm
    // the item clearly relates to the tagged civic issue. No affirmation,
    // no publication.
    if (body.relevant !== true) {
      return json({ error: 'affirm relevance to the tagged civic issue to approve' }, 400);
    }
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
