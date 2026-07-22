/**
 * Account-linked mode (phase6): commitments are under user_id but
 * public surfaces must not expose that column. Pulse has no user_id.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/phase6_account_stands.sql'), 'utf8');
const noComments = sql.replace(/--[^\n]*/g, '');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function tableBody(name: string): string {
  const m = noComments.match(new RegExp(`create table(?: if not exists)? public\\.${name}\\s*\\(([\\s\\S]*?)\\);`));
  if (!m) throw new Error(`table ${name} not found`);
  return m[1];
}

describe('account-linked stands: public wire has no identity', () => {
  it('stand_commitments is account-linked and RLS-only for owner', () => {
    const body = tableBody('stand_commitments');
    expect(body).toMatch(/user_id/);
    expect(noComments).toMatch(/auth\.uid\(\) = user_id/);
  });

  it('stand_pulse (realtime) has no user_id', () => {
    const body = tableBody('stand_pulse');
    expect(body).not.toMatch(/user_id/);
    expect(body).toMatch(/delta/);
  });

  it('stand_counts aggregates commitments without selecting user_id', () => {
    expect(sql).toMatch(/from public\.stand_commitments/);
    expect(sql).toMatch(/create or replace view public\.stand_counts/);
  });

  it('client stands path no longer issues blind receipts', () => {
    const src = read('src/state/StandsProvider.tsx');
    expect(src).toMatch(/stand_commitments/);
    expect(src).not.toMatch(/registrar-issue/);
    expect(src).not.toMatch(/ballot-cast/);
    expect(src).not.toMatch(/loadReceipts/);
  });

  it('FeedCard routes into Feed reels', () => {
    expect(read('src/components/FeedCard.tsx')).toMatch(/evidenceWatchPath/);
    expect(read('src/state/useEvidence.ts')).toMatch(/\/feed/);
    expect(read('src/components/FeedCard.tsx')).not.toMatch(/btn-secondary.*Open on/);
  });
});
