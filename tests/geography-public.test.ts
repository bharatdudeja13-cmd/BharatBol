/**
 * Geography + public aggregates (phase7).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/phase7_geography.sql'), 'utf8');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('phase7 geography + public counts', () => {
  it('defines feed_items.scope and stand_states', () => {
    expect(sql).toMatch(/scope in \('state', 'national'\)/);
    expect(sql).toMatch(/create table if not exists public\.stand_states/);
    expect(sql).toMatch(/stand_of_the_day/);
  });

  it('recreates stand_counts as security_invoker false for anon totals', () => {
    expect(sql).toMatch(/stand_counts with \(security_invoker = false\)/);
    expect(sql).toMatch(/get_national_total[\s\S]*security definer/);
    expect(sql).toMatch(/feed_reaction_counts with \(security_invoker = false\)/);
  });

  it('loadEvidence includes national scope for state tiles', () => {
    expect(read('src/state/useEvidence.ts')).toMatch(/scope\.eq\.national/);
  });

  it('Auth uses PKCE and origin redirectTo', () => {
    expect(read('src/lib/supabase.ts')).toMatch(/flowType:\s*'pkce'/);
    expect(read('src/state/AuthProvider.tsx')).toMatch(/redirectTo/);
    expect(read('src/state/AuthProvider.tsx')).toMatch(/window\.location\.origin/);
  });

  it('feed_items public surface has no submitter column', () => {
    const p4 = read('supabase/phase4_feed.sql');
    expect(p4).toMatch(/feed_items has NO submitter column/);
    expect(p4).toMatch(/approved feed items are public/);
    const create = p4.match(/create table public\.feed_items \(([\s\S]*?)\);/);
    expect(create?.[1]).not.toMatch(/user_id/);
  });

  it('EvidencePlayer keeps poster until iframe onLoad', () => {
    const src = read('src/pages/EvidencePlayer.tsx');
    expect(src).toMatch(/onLoad/);
    expect(src).toMatch(/embedReady|ready\[/);
  });

  it('Home tile lists all live stands not only breakdown rows', () => {
    expect(read('src/pages/Home.tsx')).toMatch(/openStands/);
    expect(read('src/pages/Home.tsx')).toMatch(/standStates/);
  });
});
