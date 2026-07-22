/**
 * One-per-account-per-stand, simulated end-to-end against in-memory
 * models of the two DB constraints:
 *   registrar:    primary key (user_id, stand_id) on token_issuance
 *   ballot store: unique (nullifier) on ballots
 * The SQL itself is asserted to declare these constraints in
 * unlinkability.test.ts — here we prove the protocol depends on them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { suite, blindForStand, finalizeReceipt, nullifierOf, type Receipt } from '../src/lib/blind';

const STAND = '00000000-0000-4000-8000-000000000001';

let keys: CryptoKeyPair;

/** In-memory registrar: PK (user_id, stand_id). */
class Registrar {
  issued = new Set<string>();
  async issue(userId: string, standId: string, blinded: Uint8Array): Promise<Uint8Array | null> {
    const pk = `${userId}:${standId}`;
    if (this.issued.has(pk)) return null; // duplicate key → refuse
    this.issued.add(pk);
    return suite().blindSign(keys.privateKey, blinded);
  }
}

/** In-memory ballot store: unique nullifier. */
class BallotStore {
  rows = new Map<string, { stand_id: string }>();
  async cast(r: Receipt): Promise<'ok' | 'already counted' | 'invalid'> {
    const ok = await suite().verify(
      keys.publicKey,
      Uint8Array.from(atob(r.sig_b64), (c) => c.charCodeAt(0)),
      new TextEncoder().encode(`praja:ballot:v1:${r.stand_id}:${r.token}`)
    );
    if (!ok) return 'invalid';
    const nullifier = await nullifierOf(r.stand_id, r.token);
    if (this.rows.has(nullifier)) return 'already counted'; // unique constraint
    this.rows.set(nullifier, { stand_id: r.stand_id });
    return 'ok';
  }
}

beforeAll(async () => {
  keys = await RSABSSA.SHA384.generateKey({
    publicExponent: Uint8Array.from([1, 0, 1]),
    modulusLength: 2048,
  });
}, 60000);

async function obtainReceipt(registrar: Registrar, userId: string): Promise<Receipt | null> {
  const session = await blindForStand(keys.publicKey, STAND);
  const blindSig = await registrar.issue(
    userId,
    STAND,
    Uint8Array.from(atob(session.blinded_b64), (c) => c.charCodeAt(0))
  );
  if (blindSig === null) return null;
  let s = '';
  for (const x of blindSig) s += String.fromCharCode(x);
  return finalizeReceipt(keys.publicKey, session, btoa(s));
}

describe('one per account per stand', () => {
  it('a second token request for the same (account, stand) is refused', async () => {
    const registrar = new Registrar();
    expect(await obtainReceipt(registrar, 'user-1')).not.toBeNull();
    expect(await obtainReceipt(registrar, 'user-1')).toBeNull(); // PK violation
  });

  it('the same receipt cannot be spent twice (nullifier unique)', async () => {
    const registrar = new Registrar();
    const store = new BallotStore();
    const receipt = (await obtainReceipt(registrar, 'user-1'))!;
    expect(await store.cast(receipt)).toBe('ok');
    expect(await store.cast(receipt)).toBe('already counted');
    expect(store.rows.size).toBe(1); // count stayed honest
  });

  it('two different accounts each get exactly one ballot', async () => {
    const registrar = new Registrar();
    const store = new BallotStore();
    const r1 = (await obtainReceipt(registrar, 'user-1'))!;
    const r2 = (await obtainReceipt(registrar, 'user-2'))!;
    expect(await store.cast(r1)).toBe('ok');
    expect(await store.cast(r2)).toBe('ok');
    expect(store.rows.size).toBe(2);
  });

  it('a self-made token without registrar signature is rejected', async () => {
    const store = new BallotStore();
    const fake: Receipt = {
      stand_id: STAND,
      token: 'ab'.repeat(32),
      sig_b64: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(256)))),
      nullifier: await nullifierOf(STAND, 'ab'.repeat(32)),
    };
    expect(await store.cast(fake)).toBe('invalid');
    expect(store.rows.size).toBe(0);
  });
});
