/**
 * Job 3 gate: polls must inherit the §1 privacy model wholesale.
 * Parses supabase/phase3_polls.sql with the same assertions the §1/§2
 * gates apply to stands: anonymous ballot store, sealed issuance ledger,
 * append-only log, nullifier dedup.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(__dirname, '../supabase/phase3_polls.sql'), 'utf8');
const noComments = sql.replace(/--[^\n]*/g, '');

function tableBody(name: string): string {
  const m = noComments.match(new RegExp(`create table public\\.${name}\\s*\\(([\\s\\S]*?)\\);`));
  if (!m) throw new Error(`table ${name} not found in phase3_polls.sql`);
  return m[1];
}

describe('poll ballot store carries no identity', () => {
  it('poll_ballots has no user column and no reference to auth.users or user-linked tables', () => {
    const body = tableBody('poll_ballots');
    expect(body).not.toMatch(/user_id/);
    expect(body).not.toMatch(/auth\.users/);
    expect(body).not.toMatch(/profiles|wall_entries|token_issuance/);
  });

  it('poll_ballots timestamps are date-only', () => {
    const body = tableBody('poll_ballots');
    expect(body).not.toMatch(/timestamptz|timestamp with/);
    expect(body).toMatch(/voted_on\s+date/);
  });

  it('dedup is per (poll, token): unique 64-hex nullifier + issuance PK', () => {
    expect(tableBody('poll_ballots')).toMatch(/nullifier\s+text\s+not\s+null\s+unique/);
    expect(tableBody('poll_token_issuance')).toMatch(/primary key\s*\(user_id,\s*poll_id\)/);
  });

  it('the chosen option lives only in the anonymous row (documented as unsigned)', () => {
    // The design invariant: the option is NOT part of the blind-signed
    // message (tokens are issued before any choice exists).
    expect(sql).toMatch(/CHOSEN OPTION IS NOT IN THE SIGNED MESSAGE/);
    expect(tableBody('poll_ballots')).toMatch(/option_index\s+smallint\s+not\s+null/);
  });
});

describe('poll registrar ledger is sealed; erasure cascades', () => {
  it('poll_token_issuance has RLS enabled with zero policies and zero grants', () => {
    expect(noComments).toMatch(/alter table public\.poll_token_issuance enable row level security/);
    expect(noComments).not.toMatch(/create policy[^;]*on public\.poll_token_issuance/);
    expect(noComments).not.toMatch(/grant[^;]*poll_token_issuance/);
  });

  it('the only account-linked poll table cascades from auth.users', () => {
    expect(tableBody('poll_token_issuance')).toMatch(/references auth\.users[^,]*on delete cascade/);
  });

  it('no view joins poll_ballots to any user-linked table', () => {
    const views = noComments.match(/create (or replace )?view[\s\S]*?;/g) ?? [];
    for (const v of views) {
      if (!/poll_ballots/.test(v)) continue;
      expect(v).not.toMatch(/poll_token_issuance|token_issuance|profiles|auth\.users|wall_entries/);
    }
  });
});

describe('poll log is anonymous and append-only', () => {
  it('poll_log has no user column and no foreign keys at all', () => {
    const body = tableBody('poll_log');
    expect(body).not.toMatch(/user_id/);
    expect(body).not.toMatch(/references/i);
  });

  it('immutability trigger + single public-select policy + select-only grant', () => {
    expect(noComments).toMatch(/before update or delete on public\.poll_log/);
    const policies = noComments.match(/create policy[^;]*on public\.poll_log[^;]*;/g) ?? [];
    expect(policies.length).toBe(1);
    expect(policies[0]).toMatch(/for select using \(true\)/);
    const grants = noComments.match(/grant[^;]*poll_log[^;]*;/g) ?? [];
    expect(grants.length).toBe(1);
    expect(grants[0]).toMatch(/grant select/);
  });

  it('cast and withdraw triggers mirror only anonymous columns', () => {
    const inserts = noComments.match(/insert into public\.poll_log \(([^)]*)\)/g) ?? [];
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    for (const ins of inserts) {
      expect(ins).toContain('(event, poll_id, nullifier, option_index, state, event_on)');
    }
  });
});

describe('guardrails in seed polls', () => {
  it('every seed poll includes an unsure / prefer-not-to-say option', () => {
    const seeds = sql.match(/'\[\{[\s\S]*?\]'/g) ?? [];
    expect(seeds.length).toBeGreaterThanOrEqual(2);
    for (const s of seeds) {
      expect(s).toMatch(/Unsure|Prefer not to say/);
    }
  });

  it('no seed poll names an individual, party, or company', () => {
    // Neutrality spot-check: the banned framing is "about a person/party".
    expect(sql).not.toMatch(/\b(BJP|Congress|AAP|Modi|Gandhi|minister|PM|CM)\b/i);
  });
});
