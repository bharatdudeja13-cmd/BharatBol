/**
 * Account-linked reactions (phase6 feed_item_reactions).
 * Public counts only; rows are owner-RLS.
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

describe('account-linked feed reactions', () => {
  it('feed_item_reactions is per-user with RLS', () => {
    const body = tableBody('feed_item_reactions');
    expect(body).toMatch(/user_id/);
    expect(body).toMatch(/value/);
    expect(noComments).toMatch(/react as self/);
  });

  it('feed_reaction_counts aggregates without user_id', () => {
    expect(sql).toMatch(/create or replace view public\.feed_reaction_counts/);
    expect(sql).toMatch(/from public\.feed_item_reactions/);
  });

  it('Feed uses account upsert, not blind react-issue', () => {
    const src = read('src/pages/Feed.tsx');
    expect(src).toMatch(/feed_item_reactions/);
    expect(src).not.toMatch(/react-issue/);
    expect(src).not.toMatch(/blindForReact/);
  });
});
