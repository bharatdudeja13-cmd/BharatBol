/**
 * react-cast — anonymous Useful / Not useful. No user JWT.
 * Verifies registrar signature over bharatbol:feedreact:v1:{id}:{token}.
 * Reaction value travels only in this request (not in the signed message).
 */
import {
  adminClient, b64ToBytes, importPublicKey, json, preflight, reactMessage, reactNullifierOf,
  suite, TOKEN_RE, UUID_RE,
} from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: {
    feed_item_id?: string;
    token?: string;
    sig_b64?: string;
    value?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const id = body.feed_item_id ?? '';
  const token = body.token ?? '';
  if (!UUID_RE.test(id) || !TOKEN_RE.test(token) || !body.sig_b64) {
    return json({ error: 'bad request' }, 400);
  }
  if (body.value !== 'up' && body.value !== 'down') {
    return json({ error: 'pick up or down' }, 400);
  }

  let sig: Uint8Array;
  try {
    sig = b64ToBytes(body.sig_b64);
  } catch {
    return json({ error: 'bad signature encoding' }, 400);
  }

  const publicKey = await importPublicKey();
  const ok = await suite().verify(publicKey, sig, reactMessage(id, token));
  if (!ok) return json({ error: 'invalid token' }, 403);

  const admin = adminClient();
  const { data: item } = await admin
    .from('feed_items')
    .select('id')
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();
  if (!item) return json({ error: 'unknown item' }, 404);

  const nullifier = await reactNullifierOf(id, token);
  const ins = await admin.from('feed_reactions').insert({
    feed_item_id: id,
    nullifier,
    value: body.value,
  });
  if (ins.error) {
    if (ins.error.code === '23505') {
      // Same token, new mind: update the anonymous row in place.
      const up = await admin.from('feed_reactions')
        .update({ value: body.value })
        .eq('nullifier', nullifier);
      if (up.error) return json({ error: 'store failed' }, 500);
      return json({ ok: true, nullifier, value: body.value, updated: true });
    }
    return json({ error: 'store failed' }, 500);
  }
  return json({ ok: true, nullifier, value: body.value });
});
