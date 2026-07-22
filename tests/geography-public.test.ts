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

  it('Feed reels keep poster until iframe onLoad', () => {
    const src = read('src/pages/Feed.tsx');
    expect(src).toMatch(/onLoad/);
    expect(src).toMatch(/embedReady|ready\[/);
  });

  it('Home evidence count and CTA route to Feed', () => {
    const home = read('src/pages/Home.tsx');
    expect(home).toMatch(/to="\/feed"/);
    expect(home).toMatch(/home\.evidenceCount/);
    expect(home).toMatch(/home\.watchEvidence|evidenceWatchPath/);
  });

  it('Feed surfaces submit-evidence CTA to /add', () => {
    const feed = read('src/pages/Feed.tsx');
    expect(feed).toMatch(/to="\/add"/);
    expect(feed).toMatch(/feed\.submitEvidence/);
    expect(feed).toMatch(/feed\.submitHint/);
  });

  it('citizen card truncates many stands with and N more', () => {
    expect(read('src/lib/cards.ts')).toMatch(/and \$\{more\} more/);
  });

  it('Instagram posters use Worker proxy without oEmbed token', () => {
    expect(read('worker/index.ts')).toMatch(/\/api\/ig-poster\//);
    expect(read('wrangler.jsonc')).toMatch(/\/api\/ig-poster\/\*/);
    expect(read('src/lib/evidenceMedia.ts')).toMatch(/instagramProxyPoster|\/api\/ig-poster\//);
    expect(read('src/lib/evidenceMedia.ts')).not.toMatch(/INSTAGRAM_OEMBED_TOKEN/);
  });

  it('language picker covers scheduled Indian languages + browser detect', () => {
    const langs = read('src/config/languages.ts');
    expect(langs).toMatch(/detectBrowserLang/);
    expect(langs).toMatch(/code: 'ta'/);
    expect(langs).toMatch(/code: 'te'/);
    expect(read('src/components/Header.tsx')).toMatch(/LanguageSelector/);
  });

  it('Watch tab is retired; Feed is the explore destination', () => {
    expect(read('src/components/BottomNav.tsx')).toMatch(/to="\/feed"/);
    expect(read('src/components/BottomNav.tsx')).not.toMatch(/to="\/evidence"/);
    expect(read('src/App.tsx')).toMatch(/EvidenceRedirect|Navigate to=\{`\/feed/);
  });

  it('Home tile lists all live stands not only breakdown rows', () => {
    expect(read('src/pages/Home.tsx')).toMatch(/openStands/);
    expect(read('src/pages/Home.tsx')).toMatch(/standStates/);
  });
});
