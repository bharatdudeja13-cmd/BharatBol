/**
 * §2 schema gate: the public ballot log stays anonymous and append-only.
 * Parses supabase/phase2b_public_log.sql the same way the §1 gate parses
 * phase2_privacy.sql.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(__dirname, '../supabase/phase2b_public_log.sql'), 'utf8');
const noComments = sql.replace(/--[^\n]*/g, '');

const tableMatch = noComments.match(/create table public\.ballot_log\s*\(([\s\S]*?)\);/);
if (!tableMatch) throw new Error('ballot_log not found');
const body = tableMatch[1];

describe('ballot_log carries no identity', () => {
  it('has no user_id column and no reference to auth.users or user-linked tables', () => {
    expect(body).not.toMatch(/user_id/);
    expect(body).not.toMatch(/auth\.users/);
    expect(body).not.toMatch(/profiles|wall_entries|token_issuance/);
  });

  it('has no foreign keys at all — log entries can never be cascaded away', () => {
    expect(body).not.toMatch(/references/i);
  });

  it('timestamps are date-only, same coarseness as ballots', () => {
    expect(body).not.toMatch(/timestamptz|timestamp with/);
    expect(body).toMatch(/event_on\s+date/);
  });

  it('events are constrained to cast|withdraw and nullifiers to 64-hex', () => {
    expect(body).toMatch(/check \(event in \('cast', ?'withdraw'\)\)/);
    expect(body).toMatch(/nullifier ~ '\^\[0-9a-f\]\{64\}\$'/);
  });
});

describe('ballot_log is read-only to the API and append-only in-database', () => {
  it('RLS is enabled with exactly one policy: public select', () => {
    expect(noComments).toMatch(/alter table public\.ballot_log enable row level security/);
    const policies = noComments.match(/create policy[^;]*on public\.ballot_log[^;]*;/g) ?? [];
    expect(policies.length).toBe(1);
    expect(policies[0]).toMatch(/for select using \(true\)/);
  });

  it('an immutability trigger rejects UPDATE and DELETE', () => {
    expect(noComments).toMatch(/raise exception 'ballot_log is append-only'/);
    expect(noComments).toMatch(/before update or delete on public\.ballot_log/);
  });

  it('grants are select-only', () => {
    const grants = noComments.match(/grant[^;]*ballot_log[^;]*;/g) ?? [];
    expect(grants.length).toBe(1);
    expect(grants[0]).toMatch(/grant select on public\.ballot_log/);
  });
});

describe('the mirroring triggers copy only public ballot columns', () => {
  it('cast and withdraw log functions write the fixed public column list', () => {
    const inserts = noComments.match(/insert into public\.ballot_log \(([^)]*)\)/g) ?? [];
    expect(inserts.length).toBeGreaterThanOrEqual(3); // cast fn, withdraw fn, backfill
    for (const ins of inserts) {
      expect(ins).toContain('(event, stand_id, nullifier, state, event_on)');
    }
  });

  it('triggers fire atomically with the ballots mutation (after insert / after delete)', () => {
    expect(noComments).toMatch(/after insert on public\.ballots/);
    expect(noComments).toMatch(/after delete on public\.ballots/);
  });
});
