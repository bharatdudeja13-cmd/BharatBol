/**
 * react-withdraw — delete an anonymous reaction by presenting the receipt.
 * No user JWT. Same verification as react-cast.
 */
import {
  adminClient, b64ToBytes, importPublicKey, json, preflight, reactMessage, reactNullifierOf,
  suite, TOKEN_RE, UUID_RE,
} from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { feed_item_id?: string; token?: string; sig_b64?: string };
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

  let sig: Uint8Array;
  try {
    sig = b64ToBytes(body.sig_b64);
  } catch {
    return json({ error: 'bad signature encoding' }, 400);
  }

  const publicKey = await importPublicKey();
  const ok = await suite().verify(publicKey, sig, reactMessage(id, token));
  if (!ok) return json({ error: 'invalid token' }, 403);

  const nullifier = await reactNullifierOf(id, token);
  const admin = adminClient();
  const { error } = await admin.from('feed_reactions').delete().eq('nullifier', nullifier);
  if (error) return json({ error: 'withdraw failed' }, 500);
  return json({ ok: true, nullifier });
});
