/**
 * REGISTRAR — blind-signs one token per (account, stand), for every live
 * stand, in one batch at sign-in.
 *
 * Privacy invariants enforced here:
 *  - The registrar sees only BLINDED tokens; it can never recognise the
 *    unblinded value later spent at the ballot store (RFC 9474).
 *  - Issuance is for ALL live stands regardless of preference, so the
 *    token_issuance ledger carries no signal about what anyone supports.
 *  - This function never touches the ballots table.
 */
import {
  adminClient, b64ToBytes, bytesToB64, importPrivateKey, json, preflight, suite, UUID_RE,
} from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = adminClient();

  // Authenticate the caller (registrar must know WHO to enforce one-per-account).
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !userData?.user) return json({ error: 'not signed in' }, 401);
  const userId = userData.user.id;

  let body: { requests?: { stand_id?: string; blinded_b64?: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const requests = Array.isArray(body.requests) ? body.requests : [];
  if (requests.length === 0 || requests.length > 100) return json({ error: 'bad batch' }, 400);

  const { data: liveStands, error: standsErr } = await admin
    .from('stands')
    .select('id')
    .eq('status', 'live');
  if (standsErr) return json({ error: 'stands unavailable' }, 500);
  const live = new Set((liveStands ?? []).map((s: { id: string }) => s.id));

  const privateKey = await importPrivateKey();
  const rsa = suite();
  const results: { stand_id: string; blind_sig_b64: string }[] = [];
  const refused: { stand_id: string; reason: string }[] = [];

  for (const r of requests) {
    const standId = r.stand_id ?? '';
    if (!UUID_RE.test(standId) || !live.has(standId)) {
      refused.push({ stand_id: standId, reason: 'unknown stand' });
      continue;
    }
    let blinded: Uint8Array;
    try {
      blinded = b64ToBytes(r.blinded_b64 ?? '');
      if (blinded.length !== 256) throw new Error('bad length'); // 2048-bit modulus
    } catch {
      refused.push({ stand_id: standId, reason: 'bad blinded token' });
      continue;
    }

    // Record issuance FIRST — the primary key (user_id, stand_id) is the
    // one-per-account gate. A duplicate insert means already issued.
    const ins = await admin.from('token_issuance').insert({ user_id: userId, stand_id: standId });
    if (ins.error) {
      refused.push({ stand_id: standId, reason: 'already issued' });
      continue;
    }

    const blindSig = await rsa.blindSign(privateKey, blinded);
    results.push({ stand_id: standId, blind_sig_b64: bytesToB64(blindSig) });
  }

  return json({ results, refused });
});
