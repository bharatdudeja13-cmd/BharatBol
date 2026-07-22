/**
 * THE ACCEPTANCE GATE (§1): no query path may yield account ↔ ballot.
 *
 * Two layers:
 *
 * 1. SCHEMA ASSERTIONS — parse supabase/phase2_privacy.sql and assert the
 *    structural facts the promise rests on: the ballot store carries no
 *    user identity and no FK into auth.users; the registrar ledger is
 *    sealed (RLS on, zero policies, zero grants, never read by a view);
 *    the account-linked Phase-1 pathway is dropped; erasure cascades.
 *    Also assert, at source level, that the ballot functions never read
 *    identity and the registrar function never touches ballots.
 *
 * 2. CRYPTOGRAPHIC EVIDENCE — simulate a curious registrar that logs
 *    everything it ever sees (blinded tokens + the blind signatures it
 *    produced) and then tries to link the final receipts back using every
 *    deterministic tool it has. All attempts must fail. (The rigorous
 *    guarantee is the blindness property of RFC 9474 RSABSSA; this test
 *    is mechanical evidence that our protocol actually uses it correctly
 *    — e.g. nothing leaks the token or reuses bytes across the cut.)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { suite, blindForStand, finalizeReceipt, type Receipt, type BlindingSession } from '../src/lib/blind';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/phase2_privacy.sql'), 'utf8');
const sqlNoComments = sql.replace(/--[^\n]*/g, '');

/** Extract a `create table public.X (...)` body. */
function tableBody(name: string): string {
  const m = sqlNoComments.match(new RegExp(`create table public\\.${name}\\s*\\(([\\s\\S]*?)\\);`));
  if (!m) throw new Error(`table ${name} not found in phase2_privacy.sql`);
  return m[1];
}

describe('schema: the ballot store carries no identity', () => {
  it('ballots has no user_id column and no reference to auth.users', () => {
    const body = tableBody('ballots');
    expect(body).not.toMatch(/user_id/);
    expect(body).not.toMatch(/auth\.users/);
    expect(body).not.toMatch(/profiles/);
  });

  it('ballots timestamps are date-only (no fine-grained timing channel)', () => {
    const body = tableBody('ballots');
    expect(body).not.toMatch(/timestamptz|timestamp with/);
    expect(body).toMatch(/joined_on\s+date/);
  });

  it('wall_feed (the public wall mirror) has no user_id and no auth.users reference', () => {
    const body = tableBody('wall_feed');
    expect(body).not.toMatch(/user_id/);
    expect(body).not.toMatch(/auth\.users/);
  });

  it('dedup constraints exist: unique nullifier + (user_id, stand_id) PK on issuance', () => {
    expect(tableBody('ballots')).toMatch(/nullifier\s+text\s+not\s+null\s+unique/);
    expect(tableBody('token_issuance')).toMatch(/primary key\s*\(user_id,\s*stand_id\)/);
  });
});

describe('schema: the registrar ledger is sealed', () => {
  it('token_issuance has RLS enabled and NO policies', () => {
    expect(sqlNoComments).toMatch(/alter table public\.token_issuance enable row level security/);
    expect(sqlNoComments).not.toMatch(/create policy[^;]*on public\.token_issuance/);
  });

  it('token_issuance receives no grants and feeds no view', () => {
    expect(sqlNoComments).not.toMatch(/grant[^;]*token_issuance/);
    const views = sqlNoComments.match(/create (or replace )?view[\s\S]*?;/g) ?? [];
    for (const v of views) expect(v).not.toMatch(/token_issuance/);
  });

  it('no view or function readable by the app joins ballots with any user-linked table', () => {
    const publicDefs = sqlNoComments.match(/create (or replace )?(view|function)[\s\S]*?(;|\$\$;)/g) ?? [];
    for (const def of publicDefs) {
      if (!/ballots/.test(def)) continue;
      expect(def).not.toMatch(/token_issuance|wall_entries|profiles|auth\.users/);
    }
  });
});

describe('schema: the Phase-1 linked pathway is gone and erasure cascades', () => {
  it('stand_joins and wall_events are dropped', () => {
    expect(sqlNoComments).toMatch(/drop table if exists public\.wall_events/);
    expect(sqlNoComments).toMatch(/drop table if exists public\.stand_joins/);
  });

  it('every account-linked table cascades from auth.users', () => {
    // profiles cascades in schema.sql (phase 1); assert the phase-2 tables here.
    expect(tableBody('token_issuance')).toMatch(/references auth\.users[^,]*on delete cascade/);
    expect(tableBody('wall_entries')).toMatch(/references auth\.users[^,]*on delete cascade/);
    // and the public wall mirror dies with its consented entry:
    expect(tableBody('wall_feed')).toMatch(/references public\.wall_entries[^,]*on delete cascade/);
  });

  it('wall_entries is user-controlled: every policy is scoped to auth.uid()', () => {
    const policies = sqlNoComments.match(/create policy[^;]*on public\.wall_entries[^;]*;/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(4); // select/insert/update/delete
    for (const p of policies) expect(p).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
  });
});

describe('edge functions: identity and ballots never meet', () => {
  const read = (p: string) => readFileSync(join(root, 'supabase/functions', p), 'utf8');

  it('ballot-cast and ballot-withdraw never read identity (no auth, no headers, no user tables)', () => {
    for (const f of ['ballot-cast/index.ts', 'ballot-withdraw/index.ts']) {
      const src = read(f);
      expect(src).not.toMatch(/getUser|auth\.uid|Authorization|authorization/);
      expect(src).not.toMatch(/token_issuance|wall_entries|profiles/);
    }
  });

  it('registrar-issue never touches the ballots table', () => {
    const src = read('registrar-issue/index.ts');
    expect(src).not.toMatch(/from\(['"]ballots['"]\)/);
    expect(src).not.toMatch(/nullifier/i);
  });
});

describe('crypto: a curious registrar cannot link receipts to accounts', () => {
  const STANDS = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ];
  const USERS = ['user-1', 'user-2', 'user-3'];

  let keys: CryptoKeyPair;
  // Everything the registrar ever observes, per account:
  const registrarLog: { user: string; stand: string; blinded: string; blindSig: string }[] = [];
  // What lands in the public ballot store (anonymous):
  const receipts: Receipt[] = [];

  beforeAll(async () => {
    keys = await RSABSSA.SHA384.generateKey({
      publicExponent: Uint8Array.from([1, 0, 1]),
      modulusLength: 2048,
    });
    for (const user of USERS) {
      for (const stand of STANDS) {
        const session: BlindingSession = await blindForStand(keys.publicKey, stand);
        const blindSig = await suite().blindSign(keys.privateKey, b64ToBytes(session.blinded_b64));
        registrarLog.push({ user, stand, blinded: session.blinded_b64, blindSig: bytesToB64(blindSig) });
        receipts.push(await finalizeReceipt(keys.publicKey, session, bytesToB64(blindSig)));
      }
    }
  }, 120000);

  it('blinding the same stand for different users yields unrelated blinded tokens', () => {
    const blinds = registrarLog.map((r) => r.blinded);
    expect(new Set(blinds).size).toBe(blinds.length);
  });

  it('no receipt equals, contains, or hashes to anything in the registrar log', async () => {
    for (const r of receipts) {
      for (const seen of registrarLog) {
        expect(r.sig_b64).not.toBe(seen.blindSig);
        expect(r.sig_b64).not.toBe(seen.blinded);
        expect(seen.blinded).not.toContain(r.token);
        expect(seen.blindSig).not.toContain(r.token);
        expect(r.nullifier).not.toBe(await sha256b64(seen.blinded));
        expect(r.nullifier).not.toBe(await sha256b64(seen.blindSig));
      }
    }
  });

  it('the blind signature the registrar produced verifies NO final ballot message', async () => {
    // The registrar's strongest tool: try its recorded blind signatures
    // against every ballot message in the public store. Every attempt fails —
    // the unblinding by the client is what turned them into valid signatures,
    // and that transformation is invisible to the registrar.
    for (const seen of registrarLog) {
      for (const r of receipts) {
        const ok = await suite().verify(
          keys.publicKey,
          b64ToBytes(seen.blindSig),
          new TextEncoder().encode(`bharatbol:ballot:v1:${r.stand_id}:${r.token}`)
        );
        expect(ok).toBe(false);
      }
    }
  }, 120000);

  it('receipts sharing an account share no common bytes that group them', async () => {
    // Nullifiers of the same user across stands must be pairwise unrelated —
    // otherwise the public log itself would cluster ballots by citizen.
    const byUser = new Map<string, string[]>();
    for (let i = 0; i < receipts.length; i++) {
      const user = registrarLog[i].user;
      byUser.set(user, [...(byUser.get(user) ?? []), receipts[i].nullifier]);
    }
    const all = receipts.map((r) => r.nullifier);
    expect(new Set(all).size).toBe(all.length);
    for (const nulls of byUser.values()) {
      for (let a = 0; a < nulls.length; a++) {
        for (let b = a + 1; b < nulls.length; b++) {
          expect(nulls[a].slice(0, 16)).not.toBe(nulls[b].slice(0, 16));
        }
      }
    }
  });
});

// ---- helpers ----
function b64ToBytes(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
async function sha256b64(b64: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', b64ToBytes(b64));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}
