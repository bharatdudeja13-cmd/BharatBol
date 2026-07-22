/**
 * BALLOT STORE (cast) — accepts an anonymous ballot.
 *
 * Privacy invariants enforced here:
 *  - NO authentication. The browser must call this WITHOUT a user JWT;
 *    if one is attached anyway, it is ignored and never read.
 *  - The only admission test is the registrar's blind signature over
 *    `bharatbol:ballot:v1:{stand_id}:{token}` — proof of "some eligible
 *    account, exactly once", with no way to know which account.
 *  - Dedup = unique nullifier (sha256 of the signed message).
 *  - Inserted row: stand_id, nullifier, state (validated code or null),
 *    date-only timestamp. Nothing else.
 */
import {
  adminClient, b64ToBytes, importPublicKey, json, nullifierOf, preflight,
  ballotMessage, suite, STATE_CODES, TOKEN_RE, UUID_RE,
} from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { stand_id?: string; token?: string; sig_b64?: string; state?: string | null };
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
  const state = body.state && STATE_CODES.has(body.state) ? body.state : null;

  let sig: Uint8Array;
  try {
    sig = b64ToBytes(body.sig_b64);
  } catch {
    return json({ error: 'bad signature encoding' }, 400);
  }

  const publicKey = await importPublicKey();
  const ok = await suite().verify(publicKey, sig, ballotMessage(standId, token));
  if (!ok) return json({ error: 'invalid token' }, 403);

  const admin = adminClient();
  const { data: stand } = await admin.from('stands').select('id').eq('id', standId).eq('status', 'live').maybeSingle();
  if (!stand) return json({ error: 'unknown stand' }, 404);

  const nullifier = await nullifierOf(standId, token);
  const ins = await admin.from('ballots').insert({ stand_id: standId, nullifier, state });
  if (ins.error) {
    if (ins.error.code === '23505') return json({ error: 'already counted', nullifier }, 409);
    return json({ error: 'store failed' }, 500);
  }
  return json({ ok: true, nullifier });
});
