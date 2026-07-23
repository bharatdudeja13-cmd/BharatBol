/**
 * Guardrails for the phase7 state-stands content ingest.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ISSUES, isIssueSlug } from '../src/config/issues';
import { STATES } from '../src/lib/states';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/seed_state_stands.sql'), 'utf8');
const STATE_CODES = new Set(STATES.map((s) => s.code));
const ISSUE_SLUGS = new Set(ISSUES.map((i) => i.slug));

describe('seed_state_stands.sql', () => {
  it('targets stands + stand_states with live status and fixed UUIDs', () => {
    expect(sql).toMatch(/insert into public\.stands/i);
    expect(sql).toMatch(/insert into public\.stand_states/i);
    expect(sql).toMatch(/status/);
    expect(sql).toMatch(/'live'/);
    expect(sql).toMatch(/on conflict \(id\) do update/i);
    expect(sql).toMatch(/a1000001-0000-4000-8000-000000000001/);
  });

  it('has no em dashes in user-facing copy', () => {
    expect(sql).not.toMatch(/\u2014/); // —
    expect(sql).not.toMatch(/\u2013/); // –
  });

  it('maps every category to the curated issue taxonomy', () => {
    const cats = [...sql.matchAll(/'((?:education|employment|transparency|democracy|health|environment|infrastructure|safety))',\s*'live'/g)].map(
      (m) => m[1]
    );
    expect(cats.length).toBeGreaterThanOrEqual(8);
    expect(cats.length).toBeLessThanOrEqual(20);
    for (const c of cats) {
      expect(isIssueSlug(c)).toBe(true);
      expect(ISSUE_SLUGS.has(c as never)).toBe(true);
    }
  });

  it('uses only tilegram state codes in stand_states', () => {
    const tags = [...sql.matchAll(/\('a1000001-0000-4000-8000-00000000000[7-9a-e]',\s*'([A-Z]{2})'\)/g)].map(
      (m) => m[1]
    );
    expect(tags.length).toBeGreaterThanOrEqual(8);
    for (const code of tags) {
      expect(STATE_CODES.has(code)).toBe(true);
    }
  });

  it('stays issue-framed: no party / religion markers in seed copy', () => {
    const lower = sql.toLowerCase();
    for (const banned of ['bjp', 'congress', 'aap', 'rss', 'muslim', 'hindu', 'sikh', 'christian', 'dalit']) {
      expect(lower).not.toContain(banned);
    }
  });
});
