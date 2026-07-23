/**
 * Feed gate: the public feed can never expose who submitted an item, and
 * nothing reaches the public without a human approving it.
 *
 * (Separate from the §1 ballot gate, which is unaffected: this covers the
 * disclosed asymmetry documented in docs/content-feed-design.md §2.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/phase4_feed.sql'), 'utf8');
const noComments = sql.replace(/--[^\n]*/g, '');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function tableBody(name: string): string {
  const m = noComments.match(new RegExp(`create table public\\.${name}\\s*\\(([\\s\\S]*?)\\);`));
  if (!m) throw new Error(`table ${name} not found`);
  return m[1];
}

describe('no submitter identity is exposed', () => {
  it('feed_items has no user column and no reference to auth.users', () => {
    const body = tableBody('feed_items');
    expect(body).not.toMatch(/user_id|submitter|submitted_by/);
    expect(body).not.toMatch(/auth\.users/);
  });

  it('feed_reports stores nothing about the reporter', () => {
    const body = tableBody('feed_reports');
    expect(body).not.toMatch(/user_id|reporter|auth\.users|ip\b|email/);
  });

  it('submission_ledger and admins are sealed: RLS on, zero policies, zero grants', () => {
    for (const t of ['submission_ledger', 'admins']) {
      expect(noComments).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
      expect(noComments).not.toMatch(new RegExp(`create policy[^;]*on public\\.${t}`));
      expect(noComments).not.toMatch(new RegExp(`grant[^;]*\\b${t}\\b`));
    }
  });

  it('only feed_items is granted to public roles', () => {
    const grants = noComments.match(/grant[^;]*;/g) ?? [];
    expect(grants.length).toBe(1);
    expect(grants[0]).toMatch(/grant select on public\.feed_items to anon, authenticated/);
  });

  it('no view joins feed content to the submission ledger', () => {
    const views = noComments.match(/create (or replace )?view[\s\S]*?;/g) ?? [];
    for (const v of views) expect(v).not.toMatch(/submission_ledger/);
  });

  it('the moderator queue never selects submitter identity', () => {
    const src = read('supabase/functions/feed-moderate/index.ts');
    expect(src).not.toMatch(/submission_ledger/);
  });

  it('the client never reads the ledger or admins table', () => {
    for (const f of ['src/state/useFeed.ts', 'src/pages/Feed.tsx', 'src/pages/Admin.tsx', 'src/pages/AddToFeed.tsx']) {
      expect(read(f)).not.toMatch(/submission_ledger|from\(['"]admins['"]\)/);
    }
  });
});

describe('publishing path (temporary auto-approve)', () => {
  it('the only public read policy on feed_items is status = approved', () => {
    const policies = noComments.match(/create policy[^;]*on public\.feed_items[^;]*;/g) ?? [];
    expect(policies.length).toBe(1);
    expect(policies[0]).toMatch(/for select using \(status = 'approved'\)/);
  });

  it('feed-submit auto-publishes as approved (temporary human-approved policy)', () => {
    const src = read('supabase/functions/feed-submit/index.ts');
    expect(src).toMatch(/status:\s*'approved'/);
    expect(src).toMatch(/TEMPORARY/);
    expect(src).not.toMatch(/status:\s*'pending'/);
  });

  it('feed-moderate requires membership of the sealed admins table', () => {
    const src = read('supabase/functions/feed-moderate/index.ts');
    expect(src).toMatch(/from\(['"]admins['"]\)/);
    expect(src).toMatch(/not a moderator/);
  });

  it('the automated pre-screen only flags — it never rejects', () => {
    const src = read('supabase/functions/feed-submit/index.ts');
    expect(src).toMatch(/flagged/);
    expect(src).not.toMatch(/status:\s*'rejected'/);
  });

  it('a report pulls an approved item out of the public feed', () => {
    const src = read('supabase/functions/feed-report/index.ts');
    expect(src).toMatch(/patch\.status = 're_review'/);
    expect(src).toMatch(/function shouldPullToReReview/);
    expect(src).toMatch(/SEAM/);
  });

  it('the mod queue prioritises re_review (hidden-on-report) above new pendings', () => {
    const src = read('supabase/functions/feed-moderate/index.ts');
    expect(src).toMatch(/re_review:\s*0/);
    expect(src).toMatch(/pending:\s*1/);
    const admin = read('src/pages/Admin.tsx');
    expect(admin).toMatch(/mod\.sectionReReview/);
    expect(admin).toMatch(/status === 're_review'/);
  });
});

describe('link + embed, never re-host', () => {
  it('no media bytes are stored: only url and metadata columns exist', () => {
    const body = tableBody('feed_items');
    expect(body).not.toMatch(/\bbytea\b|blob|storage|media_data/);
    expect(body).toMatch(/thumbnail_url\s+text/);
  });

  it('metadata comes from official public endpoints only (no HTML scraping)', () => {
    const src = read('supabase/functions/feed-submit/index.ts');
    const fetches = [...src.matchAll(/fetch\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(fetches.length).toBeGreaterThan(0);
    for (const f of fetches) {
      expect(f).toMatch(/oembed|instagram\.com\/p\/\$\{id\}\/media/i);
    }
    // Instagram previews must work without INSTAGRAM_OEMBED_TOKEN.
    expect(src).toMatch(/instagram\.com\/p\/\$\{id\}\/media\/\?size=l/);
    expect(src).toMatch(/graph\.facebook\.com\/v25\.0\/instagram_oembed/);
  });

  it('YouTube embeds use the privacy-enhanced host in the Feed player', () => {
    // The embed src moved into youtubeReelEmbedSrc (tests/reel-playback.test.ts);
    // the player must build it from that helper, which uses the nocookie host.
    expect(read('src/pages/Feed.tsx')).toMatch(/youtubeReelEmbedSrc\(/);
    expect(read('src/lib/evidenceMedia.ts')).toMatch(/youtube-nocookie\.com/);
    expect(read('src/components/FeedCard.tsx')).toMatch(/evidenceWatchPath/);
  });

  it('every card carries the unverified provenance label', () => {
    expect(read('src/components/FeedCard.tsx')).toMatch(/feed\.unverified/);
  });
});
