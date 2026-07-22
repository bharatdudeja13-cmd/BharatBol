/**
 * BALLOT STORE (withdraw) — deletes an anonymous ballot.
 *
 * Presenting the raw token + registrar signature IS the proof of
 * ownership: only the browser that cast the ballot holds them. No
 * authentication; no identity is learned here.
 */
import {
  adminClient, b64ToBytes, importPublicKey, json, nullifierOf, preflight,
  ballotMessage, suite, TOKEN_RE, UUID_RE,
} from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { stand_id?: string; token?: string; sig_b64?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const standId = body.stand_id ?? '';
  const token = body.token ?? '';
  if (!UUID_RE.test(standId) || !TOKEN_RE.test(token) || !body.sig_b64) {
    return json({ error: 'bad request' }, 400);
  }

  let sig: Uint8Array;
  try {
    sig = b64ToBytes(body.sig_b64);
  } catch {
    return json({ error: 'bad signature encoding' }, 400);
  }

  const publicKey = await importPublicKey();
  const ok = await suite().verify(publicKey, sig, ballotMessage(standId, token));
  if (!ok) return json({ error: 'invalid token' }, 403);

  const nullifier = await nullifierOf(standId, token);
  const admin = adminClient();
  const del = await admin.from('ballots').delete().eq('nullifier', nullifier).select('id');
  if (del.error) return json({ error: 'store failed' }, 500);
  return json({ ok: true, removed: (del.data ?? []).length });
});
