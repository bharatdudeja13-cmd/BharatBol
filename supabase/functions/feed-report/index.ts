/**
 * feed-report — the grievance/takedown path, open to everyone.
 *
 * No login required on purpose: original creators and affected people may
 * have no BharatBol account, and a takedown route that demands a login is
 * not a real takedown route. Nothing about the reporter is stored.
 *
 * A report pulls an approved item straight to `re_review`, so it leaves
 * the public feed until a human looks again. Honest trade-off (see the
 * design doc): a bad-faith report can temporarily hide an item; for this
 * content class, wrongly-hidden beats wrongly-shown.
 */
import { adminClient, json, preflight, UUID_RE } from '../_shared/common.ts';

const REASONS = [
  'doxxing', 'violence', 'targeting', 'sexual', 'minor',
  'misinfo', 'offtopic', 'copyright', 'other',
];

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { id?: string; reason?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  if (!UUID_RE.test(body.id ?? '')) return json({ error: 'bad id' }, 400);
  if (!REASONS.includes(body.reason ?? '')) return json({ error: 'pick a reason' }, 400);

  const admin = adminClient();

  const { data: item } = await admin
    .from('feed_items')
    .select('id, status, reports')
    .eq('id', body.id)
    .maybeSingle();
  if (!item) return json({ error: 'not found' }, 404);

  await admin.from('feed_reports').insert({
    feed_item_id: item.id,
    reason: body.reason,
    note: (body.note ?? '').slice(0, 500) || null,
  });

  // Approved → re_review (out of the public feed until re-checked).
  // Already-pending items just carry the report count into the queue.
  const patch: Record<string, unknown> = { reports: (item.reports ?? 0) + 1 };
  if (item.status === 'approved') {
    patch.status = 're_review';
    patch.approved_at = null;
  }
  await admin.from('feed_items').update(patch).eq('id', item.id);

  return json({ ok: true });
});
