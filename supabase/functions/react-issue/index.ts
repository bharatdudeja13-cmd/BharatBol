/**
 * react-issue — blind-sign one reaction token per (account, feed_item).
 * JWT required. Same cut as registrar-issue; distinct message domain is
 * enforced on the client when blinding (bharatbol:feedreact:v1:…).
 */
import {
  adminClient, b64ToBytes, bytesToB64, importPrivateKey, json, preflight, suite, UUID_RE,
} from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = adminClient();
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !userData?.user) return json({ error: 'not signed in' }, 401);
  const userId = userData.user.id;

  let body: { feed_item_id?: string; blinded_b64?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!UUID_RE.test(body.feed_item_id ?? '') || !body.blinded_b64) {
    return json({ error: 'bad request' }, 400);
  }

  const { data: item } = await admin
    .from('feed_items')
    .select('id')
    .eq('id', body.feed_item_id)
    .eq('status', 'approved')
    .maybeSingle();
  if (!item) return json({ error: 'unknown item' }, 404);

  let blinded: Uint8Array;
  try {
    blinded = b64ToBytes(body.blinded_b64);
    if (blinded.length !== 256) throw new Error('bad length');
  } catch {
    return json({ error: 'bad blinded token' }, 400);
  }

  const ins = await admin.from('feed_reaction_issuance').insert({
    user_id: userId,
    feed_item_id: item.id,
  });
  if (ins.error) {
    if (ins.error.code === '23505') return json({ error: 'already issued' }, 409);
    return json({ error: 'issuance failed' }, 500);
  }

  try {
    const privateKey = await importPrivateKey();
    const blindSig = await suite().blindSign(privateKey, blinded);
    return json({ blind_sig_b64: bytesToB64(blindSig) });
  } catch {
    await admin.from('feed_reaction_issuance').delete()
      .eq('user_id', userId).eq('feed_item_id', item.id);
    return json({ error: 'sign failed' }, 500);
  }
});
