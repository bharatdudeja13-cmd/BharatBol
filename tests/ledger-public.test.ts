/**
 * Task 4 gate: the public ledger exposes NO identity, and its numbers are
 * reproducible from the anonymous log the same way the page shows them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — shared plain-ESM, used by page + CLI + tests
import { canonicalEntry, entryHash, eventOf, replayLedger, canonicalCheckpoint } from '../scripts/lib/ledger.mjs';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('the ledger view carries no identity', () => {
  const page = read('src/pages/Ledger.tsx');

  it('reads only stand_pulse, never the account-linked stand_commitments', () => {
    expect(page).toMatch(/from\('stand_pulse'\)/);
    // No READ of an account-linked table (a comment naming it is fine).
    expect(page).not.toMatch(/from\(['"]stand_commitments['"]\)/);
    expect(page).not.toMatch(/from\(['"]profiles['"]\)/);
  });

  it('selects only anonymous columns (id, stand_id, delta, at)', () => {
    const sel = page.match(/\.select\('([^']+)'\)/)?.[1] ?? '';
    expect(sel).toBe('id,stand_id,delta,at');
    for (const forbidden of ['user_id', 'email', 'name', 'ip', 'account']) {
      expect(sel).not.toContain(forbidden);
    }
  });

  it('no identity-bearing token appears anywhere in the rendered page source', () => {
    for (const forbidden of [/user_id/, /\bemail\b/, /auth\.users/, /account_id/, /\bip\b/i]) {
      expect(page).not.toMatch(forbidden);
    }
  });

  it('the canonical entry encoding excludes state and any account field', () => {
    const canon = canonicalEntry({ id: 7, stand_id: 'abc', delta: 1, at: '2026-07-23T05:00:00Z' });
    expect(canon).toBe('bharatbol-ledger:v1:7:abc:stood:2026-07-23T05:00:00Z');
    expect(canon).not.toMatch(/state|user|MH|null/);
  });
});

describe('recount reproducibility', () => {
  it('replayLedger nets stood − withdrew per stand', () => {
    const entries = [
      { id: 1, stand_id: 'a', delta: 1, at: 't1' },
      { id: 2, stand_id: 'b', delta: 1, at: 't2' },
      { id: 3, stand_id: 'a', delta: -1, at: 't3' },
    ];
    const { stands, total } = replayLedger(entries);
    expect(stands).toEqual({ a: 0, b: 1 });
    expect(total).toBe(1);
  });

  it('eventOf maps delta sign to stood / withdrew', () => {
    expect(eventOf(1)).toBe('stood');
    expect(eventOf(-1)).toBe('withdrew');
  });

  it('entryHash is a deterministic 64-hex digest anyone can recompute', async () => {
    const e = { id: 13, stand_id: 'a1513fa5-69ab-410a-b10b-21edcb7e1ddf', delta: 1, at: '2026-07-22T23:53:00.888752+00' };
    const h1 = await entryHash(e);
    const h2 = await entryHash({ ...e });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the checkpoint binds size and root', () => {
    expect(canonicalCheckpoint({ size: 1, root: 'ab'.repeat(32) })).toBe(
      `bharatbol-ledger-checkpoint:v1:1:${'ab'.repeat(32)}`
    );
  });
});

describe('committed checkpoints are Rekor-signed', () => {
  it('every committed checkpoint carries a Rekor uuid + index + url', () => {
    const path = join(root, 'checkpoints/roots.jsonl');
    const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const cp = JSON.parse(line);
      expect(cp.root).toMatch(/^[0-9a-f]{64}$/);
      expect(cp.rekor_uuid).toBeTruthy();
      expect(cp.rekor_url).toMatch(/search\.sigstore\.dev/);
    }
  });

  it('the signer never uploads personal data — only hash + signature + public key', () => {
    const signer = read('scripts/checkpoint-rekor.mjs');
    expect(signer).toMatch(/hashedrekord/);
    expect(signer).not.toMatch(/user_id|email|stand_commitments/);
  });
});
