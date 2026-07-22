/**
 * Reaction gate: useful/not-useful must inherit §1 unlinkability —
 * no user column on the public store, sealed issuance, distinct domain.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/phase5_feed_reactions.sql'), 'utf8');
const noComments = sql.replace(/--[^\n]*/g, '');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function tableBody(name: string): string {
  const m = noComments.match(new RegExp(`create table public\\.${name}\\s*\\(([\\s\\S]*?)\\);`));
  if (!m) throw new Error(`table ${name} not found`);
  return m[1];
}

describe('feed reactions carry no identity', () => {
  it('feed_reactions has no user column', () => {
    const body = tableBody('feed_reactions');
    expect(body).not.toMatch(/user_id/);
    expect(body).not.toMatch(/auth\.users/);
    expect(body).toMatch(/nullifier\s+text\s+not\s+null\s+unique/);
    expect(body).toMatch(/value\s+text\s+not\s+null/);
  });

  it('issuance ledger is sealed', () => {
    expect(noComments).toMatch(/alter table public\.feed_reaction_issuance enable row level security/);
    expect(noComments).not.toMatch(/create policy[^;]*on public\.feed_reaction_issuance/);
    expect(noComments).not.toMatch(/grant[^;]*feed_reaction_issuance/);
  });

  it('signed message domain is distinct from stand ballots', () => {
    expect(read('src/lib/blind.ts')).toMatch(/bharatbol:feedreact:v1/);
    expect(read('supabase/functions/_shared/common.ts')).toMatch(/bharatbol:feedreact:v1/);
    expect(read('src/lib/blind.ts')).toMatch(/bharatbol:ballot:v1/);
  });

  it('react-cast ignores user JWTs (anon key path)', () => {
    const src = read('supabase/functions/react-cast/index.ts');
    expect(src).toMatch(/No user JWT|anonymous/i);
    expect(src).not.toMatch(/auth\.getUser/);
  });

  it('react-issue requires a signed-in user', () => {
    const src = read('supabase/functions/react-issue/index.ts');
    expect(src).toMatch(/auth\.getUser/);
    expect(src).toMatch(/feed_reaction_issuance/);
  });
});
